import psycopg2


class PostgresConnection:
    def __init__(self, _host, _database, _user, _pass):
        self.conn = psycopg2.connect(
            host=_host,
            database=_database,
            user=_user,
            password=_pass)
        self.conn.set_client_encoding('UTF8')
        self.cur = self.conn.cursor()

    def get_cursor(self):
        return self.cur

    def get_conn(self):
        return self.conn

    def __del__(self):
        self.cur.close()
        self.conn.close()
