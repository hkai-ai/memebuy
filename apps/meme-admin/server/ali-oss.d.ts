declare module "ali-oss" {
  interface OssResponse { res?: { status?: number } }
  interface OssOptions {
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    endpoint: string;
    secure?: boolean;
  }
  export default class OSS {
    constructor(options: OssOptions);
    put(key: string, body: Buffer, options?: { headers?: Record<string, string> }): Promise<OssResponse>;
    head(key: string): Promise<OssResponse>;
  }
}
