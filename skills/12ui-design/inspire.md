# Search the 12ui design corpus

Use this only when reference imagery itself is needed, or when you need direct control over corpus retrieval.

    12ui corpus inspire --query "<product, audience, surface, goal, personality>" --out-dir <directory> --count 4

`hedge` is the default mode for a text query: it spreads the first references across distinct directions while holding the query, carries retrieval evidence, and its returned order is authoritative. Use `--mode direct|balanced|adventurer|hedge` to select another locked retrieval policy. Preserve manifest order: it is ranked and diversified.

Add `--reference-image <image.png>` to rank against an existing interface. That search defaults to `balanced` instead, because the corpus refuses a hedge query that carries an image; `--mode hedge` with `--reference-image` is refused before the search runs.

If retrieval is interrupted, continue the same durable attempt:

    12ui corpus resume --out-dir <directory>
