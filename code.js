figma.showUI(__html__, { width: 240, height: 150 });

function rgb2hex(c) {
  function b(v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }
  return '#' + b(c.r) + b(c.g) + b(c.b);
}
function solidHex(p) {
  if (!p) return '#cccccc';
  if (p.type === 'SOLID' && p.color) return rgb2hex(p.color);
  if (p.boundVariables && p.boundVariables.color && p.boundVariables.color.resolvedValue)
    return rgb2hex(p.boundVariables.color.resolvedValue);
  return '#cccccc';
}

figma.ui.onmessage = function (msg) {
  if (msg.type !== 'export') return;

  const sel = figma.currentPage.selection;
  if (!sel.length || sel[0].type !== 'COMPONENT_SET') {
    figma.notify('Выделите Component Set.');
    return;
  }

  const set = sel[0];
  const buttons = [];
  const iconsNeeded = [];

  set.children.forEach(comp => {
    if (comp.type !== 'COMPONENT') return;

    const vp = comp.variantProperties || {};
    const size = (vp.Size || 'md').toLowerCase();
    const state = (vp.State || 'default').toLowerCase();
    const type = (vp.Type || 'QPushButton');

    let bg = null, area = 0;
    if ('children' in comp) {
      comp.children.forEach(n => {
        if (n.fills && n.fills.length && n.fills[0].type === 'SOLID') {
          const a = n.width * n.height;
          if (a > area) { area = a; bg = n; }
        }
      });
    }
    if (!bg) return;

    const pad = [bg.paddingTop || 4, bg.paddingRight || 8, bg.paddingBottom || 4, bg.paddingLeft || 8];

    let fSize = 14;
    comp.children.some(n => {
      if (n.type === 'TEXT' && typeof n.fontSize === 'number') {
        fSize = n.fontSize; return true;
      }
    });

    const cp = comp.componentProperties || {};
    const showIcon = cp["Show Icon"] === 'True' || cp["Show Icon"] === true;
    const showArrow = cp["Show Arrow"] === 'True' || cp["Show Arrow"] === true;

    const objName = type.replace(/\W/g, '') + '_' + size + '_' + state;
    buttons.push({
      objectName: objName,
      qtClass: type.indexOf('QToolButton') === 0 ? 'QToolButton' : 'QPushButton',
      width: bg.width,
      height: bg.height,
      fill: solidHex(bg.fills[0]),
      stroke: bg.strokes && bg.strokes[0] ? solidHex(bg.strokes[0]) : 'transparent',
      strokeW: bg.strokeWeight || 0,
      radius: typeof bg.cornerRadius === 'number' ? bg.cornerRadius : (bg.topLeftRadius || 0),
      fontSize: fSize,
      pad: pad,
      state: state,
      showIcon: showIcon,
      showArrow: showArrow
    });

    if (showIcon || showArrow) iconsNeeded.push(objName + '.png');
  });

  if (!buttons.length) {
    figma.notify('Не найдены валидные кнопки.');
    return;
  }

  const ui = [];
  ui.push('<?xml version="1.0" encoding="UTF-8"?>');
  ui.push('<ui version="4.0"><class>MyForm</class>');
  ui.push(' <widget class="QWidget" name="MyForm">');
  ui.push('  <layout class="QVBoxLayout" name="v">');

  buttons.forEach(b => {
    ui.push('   <item><widget class="' + b.qtClass + '" name="' + b.objectName + '">');
    ui.push('    <property name="geometry"><rect><x>0</x><y>0</y><width>' +
      Math.round(b.width) + '</width><height>' + Math.round(b.height) + '</height></rect></property>');
    ui.push('    <property name="text"><string>' + b.qtClass + '</string></property>');
    if (b.showIcon || b.showArrow) {
      ui.push('    <property name="iconSize"><size><width>16</width><height>16</height></size></property>');
      ui.push('    <property name="icon"><iconset><normaloff>icons/' + b.objectName + '.png</normaloff></iconset></property>');
      if (b.showArrow)
        ui.push('    <property name="toolButtonStyle"><enum>Qt::ToolButtonTextBesideIcon</enum></property>');
    }
    ui.push('    <property name="sizePolicy"><sizepolicy hsizetype="Minimum" vsizetype="Fixed">');
    ui.push('     <horstretch>0</horstretch><verstretch>0</verstretch></sizepolicy></property>');
    ui.push('   </widget></item>');
  });

  ui.push('  </layout></widget></ui>');

  const qss = [];
  buttons.forEach(b => {
    let selector = '#' + b.objectName;
    if (b.state === 'hover') selector += ':hover';
    if (b.state === 'pressed') selector += ':pressed';
    if (b.state === 'disabled') selector += ':disabled';

    qss.push(selector + ' {');
    qss.push('  background:' + b.fill + ';');
    if (b.strokeW) qss.push('  border:' + b.strokeW + 'px solid ' + b.stroke + ';');
    qss.push('  border-radius:' + b.radius + 'px;');
    qss.push('  padding:' + b.pad[0] + 'px ' + b.pad[1] + 'px ' + b.pad[2] + 'px ' + b.pad[3] + 'px;');
    qss.push('  font-size:' + b.fontSize + 'px;');
    qss.push('}');
  });

  const py = [
    'from PyQt5 import QtWidgets, uic',
    'import sys, os',
    'app = QtWidgets.QApplication(sys.argv)',
    'w = uic.loadUi(os.path.join(os.path.dirname(__file__), "MyForm.ui"))',
    'with open(os.path.join(os.path.dirname(__file__), "style.qss")) as f:',
    '    w.setStyleSheet(f.read())',
    'w.show()',
    'sys.exit(app.exec_())'
  ];

  const files = {
    'MyForm.ui': ui.join('\n'),
    'style.qss': qss.join('\n'),
    'MyForm.cpp': '// stub',
    'MyForm.h': '// stub',
    'preview.py': py.join('\n')
  };

  figma.ui.postMessage({ type: 'files', files });

  if (iconsNeeded.length)
    figma.notify('Положите иконки в папку icons/: ' + iconsNeeded.join(', '));
};
