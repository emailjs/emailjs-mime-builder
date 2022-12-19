declare class Builder {
    constructor(contetnType: string);
    build(): string;
    setContent(content: string | Uint8Array);
    setHeader(name: string, value: string);
    appendChild(node: Builder);
}
export default Builder;