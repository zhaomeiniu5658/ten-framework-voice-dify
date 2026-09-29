# Interview voice catalog

The Dify interview voice picker reads `/api/voices/volcengine`. The selected
`volcengine_voice_id` is validated on the server and mapped to both `speaker`
and `resource_id` in the TEN TTS node. Selection is locked while connecting or
connected; disconnect before changing it. The browser remembers the selection.

`catalog.json` was imported from the official Volcengine voice tables on
2026-09-29. It contains the TTS 1.0 and 2.0 catalogs, including foreign voices.
S2S-only tables and voices explicitly marked as incompatible with duplex TTS
are excluded. Public catalog membership does not imply account entitlement.
The API only exposes voices matching `BYTEDANCE_TTS_RESOURCE_ID` (including the
legacy 1.0 resource alias). This avoids offering another model service that the
current speech credentials may not have permission to use.

For live synchronization with the official `ListSpeakers` API, configure these
server-only variables in `ai_agents/.env` and restart through the usual Taskfile:

```
VOLCENGINE_ACCESS_KEY_ID=
VOLCENGINE_SECRET_ACCESS_KEY=
```

These are OpenAPI credentials, not the speech App ID/access token. They require
permission to call `ListSpeakers` for `speech_saas_prod`. No credentials are
returned to the browser. Results are cached for an hour; missing credentials
or API failures use the bundled official snapshot with a visible source notice.

Sources:
- https://docs.volcengine.com/docs/DoubaoVoice/Tonelist-1?lang=zh
- https://api.volcengine.com/api-docs/view?action=ListSpeakers&serviceCode=speech_saas_prod&version=2025-05-20

Checks: `node --test scripts/test-volcengine-voices.cjs` and `npx tsc --noEmit`.
