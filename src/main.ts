import * as cp from 'child_process'
import * as fs from 'fs'
import { join, extname } from 'path'
const name = process.argv[2]
console.log(downloadNpmPackage(name, 'latest', 'downloads/'))
type Text = string
type PackageName = string
type Format = {
    files: { [packageName: string]: { [filename: string]: Text } },
    // not sure this is enough, and I'm not sure whether 'string' is a path or a package name or a package specifier
    dependencies: {[packagename: string]: PackageName[] },
}

const format: Format = {
    files: saveTsFiles('downloads/node_modules'),
    dependencies: { [name]: gatherFilenames('downloads/node_modules', name) }
}
fs.writeFileSync('generated/output.json', JSON.stringify(format, undefined, 2))

function npmToDTName(baseName: string) {
    if (baseName.startsWith("@")) {
        return baseName.slice(1).replace('/', '__')
    }
    return baseName;
}

/** Returns path of downloaded npm package. */
function downloadNpmPackage(name: string, version: string, outDir: string): void {
    const fullName = `${name}@${version}`;
    const typesName = `@types/${npmToDTName(name)}@${version}`;
    const cpOpts: cp.ExecFileSyncOptionsWithStringEncoding = { cwd: outDir, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 } as const;
    cp.execFileSync("npm", ["install", fullName, "--no-package-lock", "--ignore-scripts"], cpOpts).trim();
    cp.execFileSync("npm", ["install", typesName, "--no-package-lock", "--ignore-scripts"], cpOpts).trim();
}

function saveTsFiles(root: string) {
    let packageMapping: { [packageName: string]: { [filename: string]: Text } } = {}
    let fileMapping: { [path: string]: string } = {}
    function walk(path: string, prefix: string[]) {
        console.log('descending:', path)
        for (const file of fs.readdirSync(join(...prefix, path), { encoding: 'utf8', withFileTypes: true })) {
            if (file.isDirectory()) {
                walk(file.name, [...prefix, path])
            }
            else if (extname(file.name) === ".ts") {
                fileMapping[join(...prefix, path, file.name)] = fs.readFileSync(join(...prefix, path, file.name), 'utf8').slice(0,100)
            }
        }
    }
    for (const dir of fs.readdirSync(root, { encoding: 'utf8', withFileTypes: true })) {
        // TODO: Need to skip @types and treat it specially
        // TODO: Also, scoped packages don't work at all because they, too, are multi-level
        if (!dir.isDirectory()) {
            console.error(`found non-directory ${dir.name} in root: ${root}`)
            continue
        }
        fileMapping = {}
        walk(dir.name, [root])
        packageMapping[dir.name] = fileMapping
    }
    return packageMapping
}

/** actually nm first gather dependents, not filenames
 * I'll change it later to collect files inside each dependent, since that should really happen as part of the first walk
 */
function gatherFilenames(root: string, start: string) {
    const files: Set<string> = new Set([start])
    function walk(name: string) {
        // TODO: Not sure whether I need package or package-lock, or prefer-package-lock with fallback
        // TODO: Need nested node_modules in case it refers to a conflicting version
        // TODO: Actually save files
        // TODO: Can't remember if I need to follow devDependencies and peerDepencies
        console.log('gathering in', name, '(with root)', root)
        const json = JSON.parse(fs.readFileSync(join(root, name, 'package.json'), 'utf8'))
        if (!json.dependencies) return;
        for (const dep of Object.keys(json.dependencies)) {
            if (!files.has(dep)) {
                files.add(dep)
                walk(dep)
            }
        }
    }
    walk(start)
    return Array.from(files)
}
