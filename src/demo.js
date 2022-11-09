import * as fs from 'fs'
import { dirname } from 'path'
/** @type {import('./main').Format} */
const output = JSON.parse(fs.readFileSync('generated/output.json', 'utf8'))
if ('react' in output.packages) {
    for (const f of output.packages.react) {
        console.log(dirname(f))
        fs.mkdirSync('generated/node_modules/' + dirname(f), { recursive: true })
        fs.writeFileSync('generated/node_modules/' + f, output.files[f])
    }
}
