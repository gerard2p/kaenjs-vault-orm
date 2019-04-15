import { readdirSync, lstatSync } from "fs";
import { targetPath } from "@kaenjs/core/utils";
import { debug as _debug } from '@kaenjs/core/debug';
const debug = _debug('vault-orm');
export const Databases = Promise.all(readdirSync(targetPath('./models'))
					.map(d => targetPath(`./models/${d}`))
					.filter(d => lstatSync(d).isDirectory())
					.map(d => require(`${d}`).Context.ready()));
export async function Seed () {
	let seeds = [];
	for (const file of readdirSync(targetPath('seeds'))) {
		if (!file.match(/\.(js|ts)$/)) continue;
		debug(`Seeding: ${file}`);
		seeds.push(require(targetPath('seeds', file)).default());
	}
	await Promise.all(seeds);	
}