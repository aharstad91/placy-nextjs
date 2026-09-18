"""Mekanisk HTML -> JSX for leangenbukta-replikaen."""
import re, json, sys, os, subprocess, html as htmlmod
from html.parser import HTMLParser

DEST = "/Users/andreasharstad/Documents/placy/public/demo/leangenbukta-nettside"
_dims = {}

def dims(public_path):
    """Faktiske pikselmål for en lokal fil, slik next/image krever width/height."""
    if public_path in _dims:
        return _dims[public_path]
    fn = os.path.join(DEST, os.path.basename(public_path))
    res = None
    if os.path.exists(fn):
        if fn.endswith('.svg'):
            txt = open(fn, encoding='utf-8', errors='replace').read(4000)
            vb = re.search(r'viewBox=["\']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)', txt)
            if vb:
                res = (round(float(vb.group(1))), round(float(vb.group(2))))
        else:
            try:
                out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', fn],
                                     capture_output=True, text=True, timeout=20).stdout
                w = re.search(r'pixelWidth:\s*(\d+)', out)
                h = re.search(r'pixelHeight:\s*(\d+)', out)
                if w and h:
                    res = (int(w.group(1)), int(h.group(1)))
            except Exception:
                res = None
    _dims[public_path] = res
    return res

ASSET_MAP = json.load(open('asset-map.json'))
PUBLIC = "/demo/leangenbukta-nettside"
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"}
DROP_TAGS = {"script","noscript","style"}

ATTR_MAP = {
    "class": "className", "for": "htmlFor", "srcset": "srcSet",
    "colspan": "colSpan", "rowspan": "rowSpan", "tabindex": "tabIndex",
    "maxlength": "maxLength", "readonly": "readOnly", "autocomplete": "autoComplete",
    "autofocus": "autoFocus", "novalidate": "noValidate", "enctype": "encType",
    "usemap": "useMap", "frameborder": "frameBorder", "allowfullscreen": "allowFullScreen",
    "crossorigin": "crossOrigin", "playsinline": "playsInline", "autoplay": "autoPlay",
    "srclang": "srcLang", "contenteditable": "contentEditable", "spellcheck": "spellCheck",
    "accesskey": "accessKey", "cellpadding": "cellPadding", "cellspacing": "cellSpacing",
    "datetime": "dateTime", "formaction": "formAction", "hreflang": "hrefLang",
    "inputmode": "inputMode", "marginwidth": "marginWidth", "marginheight": "marginHeight",
    "minlength": "minLength", "itemprop": "itemProp", "itemscope": "itemScope",
    "itemtype": "itemType", "referrerpolicy": "referrerPolicy",
    "viewbox": "viewBox", "fetchpriority": "fetchPriority",
    "preserveaspectratio": "preserveAspectRatio", "stroke-miterlimit": "strokeMiterlimit",
    "stroke-dasharray": "strokeDasharray", "stroke-dashoffset": "strokeDashoffset",
    "stop-opacity": "stopOpacity", "text-anchor": "textAnchor",
    "font-family": "fontFamily", "font-size": "fontSize", "font-weight": "fontWeight",
    "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin", "fill-rule": "fillRule", "clip-rule": "clipRule",
    "stop-color": "stopColor", "xmlns:xlink": "xmlnsXlink", "xlink:href": "xlinkHref",
}
NUMERIC_ATTRS = {"size","maxlength","minlength","rows","cols","span","start","step","tabindex","colspan","rowspan"}
BOOL_ATTRS = {"disabled","checked","readonly","required","autofocus","autoplay","controls","loop","muted","playsinline","selected","multiple","novalidate","hidden","open","default","reversed","async","defer","itemscope","allowfullscreen"}

def local_asset(url):
    clean = url.split('#')[0]
    name = ASSET_MAP.get(clean)
    return f"{PUBLIC}/{name}" if name else None

def rewrite_url(url):
    u = htmlmod.unescape(url)
    local = local_asset(u)
    return local if local else u

def camel(prop):
    if prop.startswith('--'):
        return prop
    parts = prop.strip().split('-')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])

def style_to_jsx(value):
    out = []
    for decl in value.split(';'):
        if ':' not in decl:
            continue
        k, v = decl.split(':', 1)
        k = k.strip(); v = v.strip()
        if not k or not v:
            continue
        v = re.sub(r"url\(\s*(['\"]?)([^'\")]+)\1\s*\)", lambda m: f"url('{rewrite_url(m.group(2))}')", v)
        key = camel(k)
        if not key.startswith('--') and not re.match(r'^[A-Za-z][A-Za-z0-9]*$', key):
            continue
        keyrepr = f'"{key}"' if key.startswith('--') else key
        out.append(f'{keyrepr}: {json.dumps(v)}')
    return '{ ' + ', '.join(out) + ' }' if out else None

def esc_text(t):
    t = t.replace('{', '&#123;').replace('}', '&#125;')
    return t

class Conv(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out = []
        self.skip_depth = 0
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if self.skip_depth:
            if tag not in VOID:
                self.skip_depth += 1
            return
        if tag in DROP_TAGS:
            if tag not in VOID:
                self.skip_depth = 1
            return
        self.emit_tag(tag, attrs, tag in VOID)
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        if self.skip_depth or tag in DROP_TAGS:
            return
        self.emit_tag(tag, attrs, True)

    def handle_endtag(self, tag):
        if self.skip_depth:
            if tag not in VOID:
                self.skip_depth -= 1
            return
        if tag in VOID or tag in DROP_TAGS:
            return
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        self.out.append(f'</{tag}>')

    def emit_tag(self, tag, attrs, selfclose):
        parts = []
        is_img = tag == 'img'
        # React vil ha defaultValue på ukontrollerte felt; `value` uten onChange
        # gir en advarsel og et låst felt.
        input_type = next((v for k, v in attrs if k.lower() == 'type'), '').lower()
        uncontrolled = tag in ('input', 'textarea') and input_type not in ('submit', 'button', 'reset', 'hidden', 'checkbox', 'radio', 'image')
        src_local = None
        for name, value in attrs:
            if value is None:
                value = ''
            lname = name.lower()
            if lname.startswith('on'):
                # Originalens inline-handlere hører til skript vi ikke importerer.
                continue
            if lname in ('srcset', 'sizes', 'loading', 'decoding', 'data-delay') and is_img:
                continue
            if lname == 'style':
                obj = style_to_jsx(value)
                if obj:
                    cast = ' as React.CSSProperties' if '"--' in obj else ''
                    parts.append(f'style={{{obj}{cast}}}')
                continue
            if lname in ('src', 'href', 'poster', 'data-awb-video'):
                value = rewrite_url(value)
                if lname == 'src':
                    src_local = value
            if lname == 'value' and uncontrolled:
                lname = 'defaultvalue'
                name = 'defaultValue'
            jsx_name = ATTR_MAP.get(lname, 'defaultValue' if lname == 'defaultvalue' else lname)
            if not (lname.startswith('data-') or lname.startswith('aria-')):
                if lname in BOOL_ATTRS:
                    parts.append(f'{jsx_name}={{true}}')
                    continue
            value = htmlmod.unescape(value)
            if lname in NUMERIC_ATTRS and re.fullmatch(r'-?\d+', value.strip()):
                parts.append(f'{jsx_name}={{{int(value)}}}')
            else:
                parts.append(f'{jsx_name}={json.dumps(value)}')
        if is_img:
            parts = [p for p in parts if not re.match(r'^(width|height)=', p)]
            size = dims(src_local) if src_local else None
            if size:
                parts.append(f'width={{{size[0]}}}')
                parts.append(f'height={{{size[1]}}}')
            attr_str = (' ' + ' '.join(parts)) if parts else ''
            if src_local and src_local.endswith('.svg'):
                attr_str += ' unoptimized'
            self.out.append(f'<Image{attr_str} />')
            return
        attr_str = (' ' + ' '.join(parts)) if parts else ''
        self.out.append(f'<{tag}{attr_str}' + (' />' if selfclose else '>'))

    def handle_data(self, data):
        if self.skip_depth:
            return
        if not data.strip():
            if '\n' in data:
                self.out.append('\n')
            elif data:
                self.out.append(' ')
            return
        self.out.append(esc_text(data))

    def handle_entityref(self, name):
        if self.skip_depth:
            return
        self.out.append(f'&{name};')

    def handle_charref(self, name):
        if self.skip_depth:
            return
        self.out.append(f'&#{name};')

    def handle_comment(self, data):
        pass

def convert(fragment):
    c = Conv()
    c.feed(fragment)
    c.close()
    return ''.join(c.out)

if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    print(convert(src))
