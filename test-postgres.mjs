import postgres from 'postgres';
const sql = postgres({ max: 1 });
const ids = ['uuid-1', 'uuid-2'];
const query1 = sql`select * from foo where id in ${sql(ids)}`;
console.log('Query 1 without parens:', query1);
const query2 = sql`select * from foo where id in (${sql(ids)})`;
console.log('Query 2 with parens:', query2);
process.exit(0);
