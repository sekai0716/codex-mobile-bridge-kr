package io.github.try2love.codexbridge;
import java.net.URI;
import java.net.URLEncoder;

/** Origins are explicit user choices; credentials never move to another origin. */
public final class GatewayURL {
    public static String origin(String value) throws Exception {
        URI u=new URI(value.trim());String host=u.getHost();
        if(host==null||u.getRawUserInfo()!=null||u.getRawQuery()!=null||u.getPort()>65535||u.getPort()==0)throw new Exception("자격 증명이나 쿼리 매개변수 없이 전체 게이트웨이 주소를 입력하세요.");
        String scheme=u.getScheme()==null?"":u.getScheme().toLowerCase();
        if(!scheme.equals("https")&&!(scheme.equals("http")&&local(host)))throw new Exception("공개 주소에는 HTTPS가 필요합니다. HTTP는 로컬 네트워크에서만 허용됩니다.");
        String path=u.getRawPath()==null?"":u.getRawPath();
        if(!path.isEmpty()&&!path.equals("/")&&!path.matches("/d/[a-f0-9]{32}/?"))throw new Exception("게이트웨이 주소에는 경로가 포함되어서는 안 됩니다.");
        return scheme+"://"+u.getRawAuthority().toLowerCase()+(path.startsWith("/d/")?path.replaceAll("/$",""):"");
    }
    static boolean local(String host){
        if(host.equalsIgnoreCase("localhost")||host.equals("[::1]"))return true;
        String[] p=host.split("\\.");if(p.length!=4)return false;
        int[] n=new int[4];try{for(int i=0;i<4;i++){n[i]=Integer.parseInt(p[i]);if(n[i]<0||n[i]>255||!p[i].equals(Integer.toString(n[i])))return false;}}catch(Exception e){return false;}
        return n[0]==10||n[0]==127||n[0]==192&&n[1]==168||n[0]==172&&n[1]>=16&&n[1]<=31;
    }
    public static String connection(String value)throws Exception {
        String base=origin(value);String fragment=new URI(value.trim()).getRawFragment();
        if(fragment!=null&&!fragment.isEmpty()&&!fragment.matches("pair=[A-Za-z0-9_-]{43}"))throw new Exception("컴퓨터의 게이트웨이에 있는 주소 또는 QR 코드를 사용하세요.");
        return base+"/"+(fragment==null?"":"#"+fragment);
    }
    public static String httpOrigin(String base){try{URI u=new URI(base);return u.getScheme()+"://"+u.getRawAuthority();}catch(Exception e){return "";}}
    public static String cookiePath(String base){return base.substring(httpOrigin(base).length())+"/";}
    public static String apiPath(String url,String base)throws Exception {String path=new URI(url).getRawPath();String prefix=cookiePath(base);return path.startsWith(prefix)?"/"+path.substring(prefix.length()):"";}
    public static boolean sameOrigin(String url,String origin){try{URI u=new URI(url);return u.getRawUserInfo()==null&&httpOrigin(url).equals(httpOrigin(origin))&&u.getRawPath()!=null&&u.getRawPath().startsWith(cookiePath(origin))&&!u.getRawPath().contains("%")&&!u.getRawPath().contains("/../");}catch(Exception e){return false;}}
    /** Only internal navigation accepts an allowlisted provider query. Manual addresses stay strict. */
    public static String targetBase(String value)throws Exception {
        URI u=new URI(value);String query=u.getRawQuery();
        if(query!=null&&!query.matches("client=(codex|claude|deepseek|zcode|antigravity)"))throw new Exception("잘못된 채팅 링크");
        String raw=value.split("[?#]",2)[0];return origin(raw);
    }
    public static boolean isChatPage(String url,String base){try{return base.equals(targetBase(url));}catch(Exception invalid){return false;}}
    public static String chat(String origin,String thread,String host)throws Exception {
        boolean desktop=host!=null&&(host.matches("desktop:(claude|deepseek)(:[0-9a-f]{32})?")||"desktop:zcode".equals(host)||"desktop:antigravity".equals(host));
        if(thread==null||host==null||thread.isEmpty()||thread.length()>512||host.length()>256||(thread+host).matches("(?s).*[\\x00-\\x1f\\x7f].*")||(!desktop&&(host.startsWith("desktop:")||!thread.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))))throw new Exception("잘못된 채팅 링크");
        return origin+"/#"+URLEncoder.encode(thread,"UTF-8").replace("+","%20").replace("*","%2A")+"~"+URLEncoder.encode(host,"UTF-8").replace("+","%20");
    }
}
