"""Native Secret Service items, retaining the Go client's collection choice."""
from contextlib import contextmanager, closing


@contextmanager
def target(service, user):
    import secretstorage
    with closing(secretstorage.dbus_init()) as connection:
        try:
            collection = secretstorage.Collection(connection, '/org/freedesktop/secrets/collection/login')
        except secretstorage.ItemNotFoundException:
            collection = secretstorage.get_default_collection(connection)
        collection.ensure_not_locked()
        items = list(collection.search_items({'service': service, 'username': user}))
        if len(items) > 1:
            raise ValueError('기본 로그인 자격 증명과 일치하는 항목이 여러 개 있습니다. 먼저 원래 클라이언트에서 처리하시기 바랍니다.')
        item = items[0] if items else None
        if item:
            item.ensure_not_locked()
        yield collection, item


def read(service, user):
    with target(service, user) as (_, item):
        return item.get_secret() if item else None


def write(service, user, value):
    with target(service, user) as (collection, item):
        if value is None:
            if item:
                item.delete()
        elif item:
            item.set_secret(value)
        else:
            collection.create_item("Password for '%s' on '%s'" % (user, service),
                                   {'service': service, 'username': user}, value, replace=True)
