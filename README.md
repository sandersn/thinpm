# thinpm

Static download and packaging of types from popular npm packages

## Usage

1. Run `node dist/main.js <packages...>`
2. Put the generated JSON file from `generated/output.json` somewhere you can consume it.

## Consumption

1. Load output.json
2. Loop over files in output.packages["YOUR-PACKAGE"]
3. For each file, write it to the place you'd normally expect node_modules to be:

``` js
for (const f of output.packages["YOUR-PACKAGE"]) {
    console.log(dirname(f))
    fs.mkdirSync('project/node_modules/' + dirname(f), { recursive: true })
    fs.writeFileSync(project/node_modules/' + f, output.files[f])
}
```

See src/demo.js for a full example.

## Implementation

1. Run `npm install` for all requested packages and the `@types/` equivalent.
2. For all `.ts` files in node_modules, map path to file contents.
3. For each directory in node_modules, follow entries in `dependencies`, adding files from each package along the way.

(3) is incomplete and buggy but enough to create a demo; there are probably ways to make (2) save a smaller set of files.
