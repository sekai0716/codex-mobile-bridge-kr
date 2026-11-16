package io.github.try2love.codexbridge;

import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;

/** 로컬 JVM 테스트에서만 생성·신뢰하는 HTTPS 인증서. 시스템 저장소는 변경하지 않는다. */
public final class FixtureTLS {
    private static SSLContext context;

    private FixtureTLS() {}

    private static synchronized SSLContext context() throws Exception {
        if (context != null) return context;
        Path directory = Files.createTempDirectory("cmb-fixture-tls-");
        Path store = directory.resolve("localhost.p12");
        char[] password = "fixture-only-password".toCharArray();
        try {
            // 고정 개인 키를 저장소에 넣지 않고, 테스트 실행마다 localhost 인증서를 만든다.
            Process keytool = new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "keytool").toString(),
                "-genkeypair", "-alias", "fixture", "-keyalg", "RSA", "-keysize", "2048",
                "-validity", "1", "-dname", "CN=localhost",
                "-ext", "SAN=IP:127.0.0.1,DNS:localhost", "-storetype", "PKCS12",
                "-keystore", store.toString(), "-storepass", new String(password), "-noprompt"
            ).redirectErrorStream(true).start();
            byte[] output = keytool.getInputStream().readAllBytes();
            if (keytool.waitFor() != 0) throw new IllegalStateException(new String(output));
            KeyStore keys = KeyStore.getInstance("PKCS12");
            try (InputStream input = Files.newInputStream(store)) { keys.load(input, password); }
            KeyManagerFactory managers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            managers.init(keys, password);
            TrustManagerFactory trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            trust.init(keys);
            SSLContext fixture = SSLContext.getInstance("TLS");
            fixture.init(managers.getKeyManagers(), trust.getTrustManagers(), new SecureRandom());
            // 이 fixture JVM 안에서만 테스트 인증서를 신뢰하며, 기본 호스트명 검증은 유지한다.
            HttpsURLConnection.setDefaultSSLSocketFactory(fixture.getSocketFactory());
            context = fixture;
            return fixture;
        } finally {
            Files.deleteIfExists(store);
            Files.deleteIfExists(directory);
        }
    }

    public static ServerSocket socket() throws Exception {
        return context().getServerSocketFactory().createServerSocket(
            0, 16, InetAddress.getByName("127.0.0.1"));
    }

    public static HttpsServer server() throws Exception {
        HttpsServer server = HttpsServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setHttpsConfigurator(new HttpsConfigurator(context()));
        return server;
    }
}
