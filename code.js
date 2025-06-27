function rgbToHex(r, g, b) {
    function to255(v) { return Math.round(v * 255); }
    return '#' + [r, g, b].map(x => to255(x).toString(16).padStart(2, '0')).join('');
}

figma.showUI(__html__, { width: 300, height: 200 });

figma.ui.onmessage = async (msg) => {
    if (msg.type === 'export') {
        const selection = figma.currentPage.selection;
        if (selection.length !== 1 || selection[0].type !== 'COMPONENT_SET') {
            figma.ui.postMessage({ type: 'status', data: 'Please select one Component Set.' });
            return;
        }

        const set = selection[0];
        const variants = set.children;
        const uiWidgets = [];
        const qssRules = [];

        for (const variant of variants) {
            const props = variant.variantProperties || {};
            const size = props.Size || 'md';
            const state = props.State || 'active';
            const type = props.Type || 'QPushButton';
            const id = `${size}_${state}`;

            let label = 'Button';
            const textNode = variant.findOne(n => n.type === 'TEXT');
            if (textNode) label = textNode.characters;

            const rect = variant.findOne(n => n.type === 'RECTANGLE');
            let color = '#CCCCCC';
            if (rect && rect.fills && rect.fills[0] && rect.fills[0].type === 'SOLID') {
                const c = rect.fills[0].color;
                color = rgbToHex(c.r, c.g, c.b);
            }

            uiWidgets.push(`  <widget class="${type}" name="${id}">\n    <property name="text"><string>${label}</string></property>\n  </widget>`);
            qssRules.push(`${type}#${id} { background: ${color}; }`);
        }

        const formXml = `<ui version="4.0">\n <widget class="QWidget" name="MyForm">\n${uiWidgets.join('\n')}\n </widget>\n</ui>`;
        const qss = qssRules.join('\n');
        const cpp = `// MyForm.cpp\n#include \"MyForm.h\"`;
        const h = `// MyForm.h\nclass MyForm {};`;
        const preview = `# preview.py\nprint('Preview placeholder')`;

        const zip = new JSZip();
        zip.file('MyForm.ui', formXml);
        zip.file('style.qss', qss);
        zip.file('MyForm.cpp', cpp);
        zip.file('MyForm.h', h);
        zip.file('preview.py', preview);
        const content = await zip.generateAsync({ type: 'uint8array' });
        figma.ui.postMessage({ type: 'download', data: content });
    }
};