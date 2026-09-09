"""Compose actual source / Google before / Google after evidence, keeping attribution."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',type=Path,required=True)
    parser.add_argument('--evidence',type=Path,required=True)
    args=parser.parse_args()
    before=json.loads((args.evidence/'before/capture.json').read_text())
    after=json.loads((args.evidence/'after/capture.json').read_text())
    assert before['placement']==after['placement'] and before['viewport']==after['viewport']
    before_views={v['id']:v for v in before['views']}
    assert len(before_views)==len(after['views'])==11
    for view in after['views']:
        assert view['camera']==before_views[view['id']]['camera'], f"Camera changed: {view['id']}"
    output=args.evidence/'compare';output.mkdir(exist_ok=True)
    for direction in [0,24,36,48,72]:
        name=f'render-{direction}'
        source=next((args.data/'renders/bygg-b').glob(f'{direction:03}_*.webp'))
        files=[source,args.evidence/'before'/f'{name}.jpg',args.evidence/'after'/f'{name}.jpg']
        sheet=Image.new('RGB',(2400,494),'white');draw=ImageDraw.Draw(sheet)
        for i,(path,label) in enumerate(zip(files,['Originalrender (FOV differs)','Google before','Google after'])):
            image=Image.open(path);image.thumbnail((800,450))
            sheet.paste(image,(i*800,24));draw.text((i*800+8,7),label,fill='black')
        draw.text((8,479),'Google before/after: identical camera, heading115, scale1. Source: approximate bearing; original has wider FOV.',fill='black')
        sheet.save(output/f'source-before-after-{direction:03}.jpg',quality=92)
    # Additional close detail comparisons. Full frames above retain context and attribution.
    for name in ['near','mid']:
        sheet=Image.new('RGB',(1920,570),'white');draw=ImageDraw.Draw(sheet)
        for i,stage in enumerate(['before','after']):
            im=Image.open(args.evidence/stage/f'{name}.jpg');im.thumbnail((960,540))
            sheet.paste(im,(960*i,25));draw.text((960*i+8,6),stage,fill='black')
        sheet.save(output/f'before-after-{name}.jpg',quality=92)
    print('11/11 exact camera matches; 7 comparison sheets written')


if __name__=='__main__':
    main()
