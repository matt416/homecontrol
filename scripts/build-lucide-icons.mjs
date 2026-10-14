// Run from the repository root after npm ci in frame.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '../frame-web/node_modules/@resvg/resvg-js/index.js';
import React from '../frame-web/node_modules/react/index.js';
import { renderToStaticMarkup } from '../frame-web/node_modules/react-dom/server.node.js';
import icons from '../frame-web/node_modules/lucide-react/dist/cjs/lucide-react.js';

const names = { images:'Images', calendar:'Calendar', trash:'Trash2', 'cloud-sun':'CloudSun', panels:'PanelsTopLeft', settings:'Settings', circle:'Circle', 'map-pin':'MapPin', info:'Info', 'circle-check':'CircleCheck', 'triangle-alert':'TriangleAlert', 'circle-alert':'CircleAlert', refresh:'RefreshCw', 'circle-minus':'CircleMinus', recycle:'Recycle', leaf:'Leaf', bag:'ShoppingBag', 'chevron-left':'ChevronLeft', 'chevron-right':'ChevronRight', sliders:'SlidersHorizontal', 'external-link':'ExternalLink', grip:'GripHorizontal', 'arrow-down-to-line':'ArrowDownToLine', image:'Image', shield:'ShieldCheck' };
await mkdir('macos/Assets/Lucide', {recursive:true});
await mkdir('macos/Sources/HomeControl/Resources/Icons', {recursive:true});
async function render(source, destination, size) {
  const renderer = new Resvg(await readFile(source, 'utf8'), {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  });
  await writeFile(destination, renderer.render().asPng());
}
for (const [name, component] of Object.entries(names)) {
  const svg = renderToStaticMarkup(React.createElement(icons[component], {color:'#000000', strokeWidth:1.8}));
  const source=`macos/Assets/Lucide/${name}.svg`;
  await writeFile(source,svg+'\n');
  await render(source,`macos/Sources/HomeControl/Resources/Icons/${name}.png`,72);
}
