# Search the 12ui design corpus

Use this only when reference imagery itself is needed, or when you need direct control over corpus retrieval.

    12ui corpus inspire --query "<product, audience, surface, goal, personality>" --out-dir <directory> --count 4

`hedge` is the default mode: it spreads the first references across distinct directions while holding the query, carries retrieval evidence, and its returned order is authoritative. Use `--mode direct|balanced|adventurer|hedge` to select another locked retrieval policy. Add `--reference-image <image.png>` to rank against an existing interface. Preserve manifest order: it is ranked and diversified.

If retrieval is interrupted, continue the same durable attempt:

    12ui corpus resume --out-dir <directory>
