# Search the 12ui design corpus

Use this only when reference imagery itself is needed, or when you need direct control over corpus retrieval.

    12ui corpus inspire --query "<product, audience, surface, goal, personality>" --out-dir <directory> --count 4

`balanced` is the default mode. Use `--mode direct|balanced|adventurer|hedge` to select a locked retrieval policy; `hedge` carries retrieval evidence and its returned order is authoritative. Add `--reference-image <image.png>` to rank against an existing interface. Preserve manifest order: it is ranked and diversified.

If retrieval is interrupted, continue the same durable attempt:

    12ui corpus resume --out-dir <directory>
