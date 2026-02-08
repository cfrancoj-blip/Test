
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
// Use absolute path for output directory to avoid CWD ambiguity
const OUT_DIR = path.resolve(__dirname, 'dist');

async function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.promises.copyFile(srcPath, destPath);
        }
    }
}

async function build() {
    console.log(`Building for ${isProd ? 'production' : 'development'}...`);
    console.log(`Output Directory: ${OUT_DIR}`);

    // Ensure output dir exists
    if (fs.existsSync(OUT_DIR)) {
        await fs.promises.rm(OUT_DIR, { recursive: true, force: true });
    }
    await fs.promises.mkdir(OUT_DIR, { recursive: true });

    // 1. Bundle App (index.tsx -> bundle.js + bundle.css)
    const ctx = await esbuild.context({
        entryPoints: ['index.tsx'],
        bundle: true,
        outfile: path.join(OUT_DIR, 'bundle.js'),
        minify: isProd,
        sourcemap: !isProd,
        format: 'esm',
        target: ['es2020'],
        define: {
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            'process.env.API_KEY': JSON.stringify(process.env.API_KEY || process.env.GEMINI_API_KEY || ''),
        },
        loader: {
            '.svg': 'text',
            '.png': 'file',
            '.jpg': 'file',
            '.gif': 'file',
        },
        logLevel: 'info',
    });

    if (isProd) {
        await ctx.rebuild();
        await ctx.dispose();
    } else {
        await ctx.watch();
    }

    // 2. Bundle Worker (services/sync.worker.ts -> sync-worker.js)
    await esbuild.build({
        entryPoints: ['services/sync.worker.ts'],
        bundle: true,
        outfile: path.join(OUT_DIR, 'sync-worker.js'),
        minify: isProd,
        format: 'esm',
        target: ['es2020'],
    });

    // 3. Copy Static Assets
    const copyFile = async (src, dest) => {
        const sourcePath = path.resolve(__dirname, src);
        if (fs.existsSync(sourcePath)) {
            await fs.promises.copyFile(sourcePath, dest);
        } else {
            console.warn(`Warning: Asset ${src} not found.`);
        }
    };

    // Transform index.html to remove Vite dev script for production
    const indexHtmlPath = path.resolve(__dirname, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
        let html = await fs.promises.readFile(indexHtmlPath, 'utf-8');
        if (isProd) {
            html = html.replace(/<script type="module" src="\/index\.tsx"><\/script>/g, '');
            html = html.replace(/<script type="module" src="\/@vite\/client"><\/script>/g, '');
            html = html.replace(/<link rel="stylesheet" href="\/index\.css">\s*/g, '');
            // Ensure bundle.js is loaded
            if (!html.includes('src="bundle.js"')) {
                 html = html.replace('</body>', '<script src="bundle.js" type="module"></script></body>');
            }
        }
        await fs.promises.writeFile(path.join(OUT_DIR, 'index.html'), html);
    } else {
        console.error("Error: index.html not found.");
        process.exit(1);
    }

    await copyFile('manifest.json', path.join(OUT_DIR, 'manifest.json'));
    await copyFile('sw.js', path.join(OUT_DIR, 'sw.js'));
    
    // Copy Dirs
    await copyDir(path.resolve(__dirname, 'locales'), path.join(OUT_DIR, 'locales'));
    await copyDir(path.resolve(__dirname, 'icons'), path.join(OUT_DIR, 'icons'));
    await copyDir(path.resolve(__dirname, 'assets'), path.join(OUT_DIR, 'assets')); 

    console.log('Build complete.');
}

build().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
