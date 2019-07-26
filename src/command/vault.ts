import * as mce from '@gerard2p/mce-types';
import * as mce_console from '@gerard2p/mce-types/console';
import * as mce_utils from '@gerard2p/mce-types/utils';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from "path";
const { bool, list, text } = require(join(require.main.paths[0], '@gerard2p/mce')) as typeof mce;
const { ok } = require(join(require.main.paths[0], '@gerard2p/mce/console')) as typeof mce_console;
const { cliPath, targetPath, created, updated, render } = require(join(require.main.paths[0],'@gerard2p/mce/utils')) as typeof mce_utils;
const { configuration } = require(join(require.main.paths[0],'../utilities/configurations'));
const { inflector } = require(join(require.main.paths[0],'../utilities/inflector'));

let {server:{name} = {name:''} } = configuration;
let appName = name;
export let description = 'Creates a new model';
export let args = '<context> <model>';
enum States {
    no,
    updated,
    created
}
enum KaenPrimitives {
    id = 'Id',
    string = 'string',
    email = 'string',
    number = 'number',
    boolean = 'boolean',
    json = 'object',
    belongsto = 'Related<{{model}}>',
    hasone = 'Related<{{model}}>',
    hasmany = 'List<{{model}}>'
}
let valid_drivers = /mongo|mysql\-x/;
let valid_fields = Object.keys(KaenPrimitives).join('|');
let files_validation = new RegExp(`^.*:(${valid_fields})(:.*)?`);
export let options = {
    force: bool('', 'rebuilds the file'),
    driver: text('-d <driver>', 'Select the driver to connect',valid_drivers, 'mongo'),
    db: text('<host:database:port>', 'Database and Port to connect',/^.*\:[0-9]*$/, `localhost:${appName}_db:27017`),
    fields: list('-f <field>', `[repetable] Field name and configuration. (name:[${valid_fields}])`, files_validation, [])
};
export async function action(context:string, model:string, opt:mce.Parsed<typeof options>) {
    let cname = inflector.capitalize(model);
    let [host, database, port] = opt.db.split(':');
    // let {context} = opt;
    let l_context = context.toLowerCase();
    let fields = opt.fields.map(f=>f.split(':')).reverse();
    if ( !existsSync(targetPath('src/models', l_context)) ) {
        mkdirSync(targetPath('src/models', l_context));
        created(targetPath('src/models', l_context));
    }
    let model_path = targetPath('src/models', l_context, `${model.toLowerCase()}.ts`);
    let context_path = targetPath('src/models', l_context, 'index.ts');
    let context_updated = States.no;
    let model_updated = States.no;
    if ( !existsSync(context_path) ) {
        context_updated = States.created;
        render(cliPath('templates/models/index.ts.tmp'), { host, database, port, context, driver:opt.driver}, context_path);
    }
    if ( !existsSync(model_path) || opt.force ) {
        model_updated = States.created;
        render(cliPath('templates/models/model.ts.tmp'), {cname, host, database, port, context}, model_path);
	}
	let ModelText = readFileSync(model_path, 'utf-8');
	let ContextText = readFileSync(context_path, 'utf-8');
    if ( /import \{ Repository \} from '@gerard2p\/vault\-orm\/adapters\/.*';/.exec(ModelText) === null) {
        ModelText = ModelText.replace(/.*import(.*)types';\n/, `import$1types';\nimport { Repository } from '@gerard2p/vault-orm/adapters/${opt.driver}';\n`)
    }
    for(let [property, kind] of fields) {
        let declregexp = new RegExp(` ${property}:${kind}`);
        if ( !declregexp.exec(ModelText) ) {
            let model = inflector.capitalize(property);
            let decorator = '@Property';
            let primitive = KaenPrimitives[kind];
            let Property = property;
            switch(kind) {
                case 'hasmany':
                    decorator = `@HasMany(o=>${model})`;
                    Property = inflector.pluralize(property);
                    break;
                case 'belongsto':
                    decorator = `@BelongsTo(o=>${model})`;
                    break;
                case 'hasone':
                decorator = `@HasOne(o=>${model})`;
                    break;
                default:
                    decorator = '@Property';
                    break;
            }
            switch(kind) {
                case 'hasmany':
                case 'belongsto':
                case 'hasone':
                    primitive = primitive.replace('{{model}}', model);
                    if ( !new RegExp(`import.*${model}.*from.*;?`).exec(ModelText) ) {
                        ModelText = ModelText.replace(/export class(.*)\n/, `import { ${model} } from './${property}';\nexport class$1\n`);
                    } else {
						primitive = undefined;
					}
                    break;
			}
			if(primitive) {
            	ModelText = ModelText.replace(/(.*)extends Repository(.*){\n/, `$1extends Repository {\n\t${decorator} ${Property}:${primitive}\n`)
				if(model_updated === States.no) model_updated = States.updated;
			}
        }
    }
    writeFileSync(model_path, ModelText);
    if ( /import.*VaultORM.*/.exec(ContextText) === null) {
        ContextText = `import { VaultORM, Collection, RelationMode, collection } from '@gerard2p/vault-orm/adapters/${opt.driver}';\n` + ContextText;
    }
    if ( new RegExp(`import.*${cname}.*`).exec(ContextText) === null) {
        ContextText = ContextText.replace(new RegExp(`import(.*)VaultORM(.*)\n`), `import$1VaultORM$2\nimport { ${cname} } from './${model.toLowerCase()}';\n`);
	}
	if ( new RegExp(`export.*${cname}.*`).exec(ContextText) === null) {
        ContextText = ContextText.replace(
			new RegExp(`export +\{ +(.*) +\};`),
			`export { $1, ${cname} };`
			);
    }
    if ( !new RegExp(` Collection<${cname}>`).exec(ContextText) ) {
        ContextText = ContextText.replace(/VaultORM {\n/, `VaultORM {\n\t@collection(${cname}) ${inflector.pluralize(model)}: Collection<${cname}>\n`)
        if(context_updated === States.no) context_updated = States.updated;1
    }
    writeFileSync(context_path, ContextText);
    switch(context_updated) {
        case States.created: created(context_path);break;
        case States.updated: updated(context_path);break;
    }
    switch(model_updated) {
        case States.created: created(model_path);break;
        case States.updated: updated(model_path);break;
    }
}
