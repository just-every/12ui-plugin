# Search the 12ui design corpus

Use the design DB when reference imagery itself is needed or when it helps ground local design work. Search, status and reference downloads are free without an account, subject to abuse and service-budget limits. Local preparation, generation and registration do not depend on retrieval. Import chosen downloaded reference files into the [persistent workspace](session.md) before using them as operation inputs. Preserve source attribution and retrieval evidence.

    12ui corpus status
    12ui corpus inspire --query "<surface, layout, typography, imagery, palette>" --out-dir <directory> --count 4

`balanced` is the standalone CLI, SDK and MCP default with or without credentials. It weighs relevance, quality and variety. Use `--mode direct|balanced|adventurer` to select an account-free retrieval policy. Preserve manifest order: it is ranked and diversified. Anonymous requests accept at most 24 references and an 8 KB query. An existing supplied credential is retained; invalid credentials are not silently retried anonymously.

Explicit `--mode hedge` requires an account because it runs hosted planning. For account-free planning, use the current session to develop directions, then search those directions with balanced, direct or adventurer. Hedge caption generation accepts at most 400 characters after whitespace normalization; longer keyed queries automatically use balanced retrieval with the complete text and a recorded explanation. The separate legacy hosted draft command keeps its own reference-search policy.

Add `--reference-image <image.png>` to rank against an existing PNG, JPEG or WebP interface. The default remains balanced. Explicit hedge cannot carry a reference image and is refused before the search runs.

If retrieval is interrupted, continue the same durable attempt:

    12ui corpus resume --out-dir <directory>

For HTTP 429, wait for the reported Retry-After interval and resume the same attempt. Do not start sign-in, buy credits, or create replacement search identities to bypass limits. The service still incurs retrieval costs; free access does not make model execution or image generation free.
