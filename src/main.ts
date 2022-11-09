import * as cp from 'child_process'
import * as fs from 'fs'
import { join, extname } from 'path'
const names = process.argv.slice(2)
type Text = string
type Path = string
type PackageName = string
type PackagedFiles = { [packageName: PackageName]: { [filename: Path]: Text } }
type FlatFiles = { [filename: Path]: Text }
export type Format = {
    files: FlatFiles
    packages: { [packageName: PackageName]: Path[] },
}

const format: Format = {
    files: {},
    packages: {},
}
if (!fs.existsSync('downloads')) fs.mkdirSync('downloads')
for (const name of names) {
    console.log('******** npm install', name, "**********************")
    downloadNpmPackage(name, 'latest', 'downloads/')
}
const packagedFiles = saveTsFiles('downloads/node_modules')
for (const name of names) {
    format.packages[name] = gatherFilenames('downloads/node_modules', name, packagedFiles)
}
format.files = flattenPackageFiles(packagedFiles)
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
    const cpOpts: cp.ExecFileSyncOptionsWithStringEncoding = {
        cwd: outDir,
        encoding: "utf8",
        maxBuffer: 100 * 1024 * 1024,
        stdio: 'ignore'
    } as const;
    try {
        cp.execFileSync("npm", ["install", fullName, "--no-package-lock", "--ignore-scripts"], cpOpts);
    }
    catch (e) {
        console.log('package', name, 'not found\n', e)
        return // If the package doesn't exist, don't bother with types
    }
    try {
        cp.execFileSync("npm", ["install", typesName, "--no-package-lock", "--ignore-scripts"], cpOpts);
    }
    catch (e) {
        console.log('no @types package for', name)
    }
}

function saveTsFiles(root: string): PackagedFiles {
    let packageMapping: { [packageName: string]: { [filename: string]: Text } } = {}
    let fileMapping: { [path: string]: string } = {}
    function walk(path: string, prefix: string[]) {
        for (const file of fs.readdirSync(join(root, ...prefix, path), { encoding: 'utf8', withFileTypes: true })) {
            if (file.isDirectory()) {
                walk(file.name, [...prefix, path])
            }
            else if (extname(file.name) === ".ts") {
                fileMapping[join(...prefix, path, file.name)] = fs.readFileSync(join(root, ...prefix, path, file.name), 'utf8').slice(0,100)
            }
        }
    }
    for (const dir of fs.readdirSync(root, { encoding: 'utf8', withFileTypes: true })) {
        if (dir.name.startsWith('.')) continue
        if (!dir.isDirectory()) {
            console.error(`found non-directory ${dir.name} in root: ${root}`)
            continue
        }
        if (dir.name.startsWith("@")) {
            for (const scopedir of fs.readdirSync(join(root, dir.name), { encoding: 'utf8', withFileTypes: true })) {
                fileMapping = {}
                walk(scopedir.name, [dir.name])
                packageMapping[join(dir.name, scopedir.name)] = fileMapping
            }
        }
        else {
            fileMapping = {}
            walk(dir.name, [])
            packageMapping[dir.name] = fileMapping
        }
    }
    return packageMapping
}

function flattenPackageFiles(packageFiles: PackagedFiles) {
    const flat: FlatFiles = {}
    for (const p in packageFiles) {
        for (const f in packageFiles[p]) {
            flat[f] = packageFiles[p][f]
        }
    }
    return flat
}

/** actually nm first gather dependents, not filenames
 * I'll change it later to collect files inside each dependent, since that should really happen as part of the first walk
 * TODO: Maybe use `tsc --listFiles` to get file list instead of walking package.json
 */
function gatherFilenames(root: string, start: string, packagedFiles: PackagedFiles) {
    const files: Set<string> = new Set([])
    const deps: Set<string> = new Set([start])
    function walk(name: string) {
        // TODO: Not sure whether I need package or package-lock, or prefer-package-lock with fallback
        // TODO: Need nested node_modules in case it refers to a conflicting version
        // TODO: Can't remember if I need to follow devDependencies and peerDepencies
        if (!(name in packagedFiles)) {
            return
        }
        for (const file of Object.keys(packagedFiles[name])) {
            files.add(file)
        }
        const json = JSON.parse(fs.readFileSync(join(root, name, 'package.json'), 'utf8'))
        if (!json.dependencies) return;
        for (const dep of Object.keys(json.dependencies)) {
            if (!deps.has(dep)) {
                deps.add(dep)
                walk(dep)
            }
        }
    }
    walk(start)
    walk("@types/" + start)
    return Array.from(files)
}
