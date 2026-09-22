"""Limit the deployed image to the interview graph, without altering source files."""
import json
import sys
from pathlib import Path


def prepare(app_dir):
    path = app_dir / 'property.json'
    properties = json.loads(path.read_text())
    graph = next(g for g in properties['ten']['predefined_graphs'] if g['name'] == 'va_dify_azure')
    graph['graph']['nodes'] = [n for n in graph['graph']['nodes'] if n['name'] != 'weatherapi_tool_python']
    for connection in graph['graph']['connections']:
        if connection['extension'] == 'main_control':
            connection['cmd'] = [c for c in connection['cmd'] if 'tool_register' not in c.get('names', [])]
    properties['ten']['predefined_graphs'] = [graph]
    path.write_text(json.dumps(properties, ensure_ascii=False, indent=2) + '\n')
    path = app_dir / 'manifest.json'
    manifest = json.loads(path.read_text())
    keep = {'ten_runtime_go', 'ten_ai_base', 'agora_rtc', 'bytedance_llm_based_asr', 'bytedance_tts_duplex', 'dify_llm2_python', 'message_collector2'}
    manifest['dependencies'] = [d for d in manifest['dependencies'] if d.get('name', Path(d.get('path', '')).name) in keep]
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    prepare(Path(sys.argv[1]))
