import Database from 'better-sqlite3';
const db = new Database('/tmp/electron-test/pos.sqlite');
console.log('OK open', db.prepare('SELECT sqlite_version() v').get().v);
db.exec('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, name TEXT)');
const ins = db.prepare('INSERT INTO t (name) VALUES (?)');
ins.run('hello');
console.log('OK insert', db.prepare('SELECT * FROM t').all().length);
db.close();
console.log('OK close');
