import { SimpleTexture } from './simple-texture';

import { ccclass, serializable } from 'cc.decorator';

@ccclass('cc.Texture2DArray')
export class Texture2DArray extends SimpleTexture {

    public _serialize(ctxForExporting: any):Record<string, unknown> | null {
        console.warn(`Texture2DArray:_serialize`);
        return null;
    }

    public _deserialize(serializedData: any, handle: any): void {
        console.warn(`Texture2DArray:_deserialize`);
    }

}
