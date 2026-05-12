"""
ShortDrama-Agent 后端快速测试
启动前确保: node backend/src/index.js 已在运行
"""
import urllib.request
import json
import uuid
import io
import time
import sys

# 强制 UTF-8 编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "http://localhost:3000"

# ============ 1. 列出项目 ============
resp = urllib.request.urlopen(f"{BASE}/api/projects")
data = json.loads(resp.read())
print(f"✅ 项目列表: {len(data.get('projects', []))} 个项目")

# ============ 2. 创建项目 ============
pid = f"test_{uuid.uuid4().hex[:8]}"
body = json.dumps({"name": f"LLM测试_{pid}", "style": "真人"}).encode()
req = urllib.request.Request(f"{BASE}/api/projects", data=body, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
proj = json.loads(resp.read())["project"]
pid = proj["id"]
print(f"✅ 创建项目: {proj['name']} ({pid})")

# ============ 3. 创建资产 ============
for entity_data in [
    ("characters", "林远"),
    ("characters", "李明"),
    ("scenes", "办公室"),
    ("scenes", "咖啡馆"),
]:
    body = json.dumps({"name": entity_data[1]}).encode()
    req = urllib.request.Request(f"{BASE}/api/assets/{pid}/{entity_data[0]}", data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    ent = json.loads(resp.read())["entity"]
    print(f"✅ 创建{entity_data[0]}: {ent['name']} ({ent['id']})")

# ============ 4. 上传剧本 ============
script_content = """第一场 - 深夜办公室

林远坐在电脑前，屏幕的蓝光映在他疲惫的脸上。墙上的时钟指向凌晨两点。

林远（自言自语）：这次的项目方案，必须在下周一前拿出来。

电话铃声突然响起。林远看了一眼来电显示，犹豫了一下，接起电话。

李明（电话里）：林远，我是李明。听说你在做新方案？我想跟你谈谈合作的事。

林远（警惕地）：李总？您不是已经……

李明（打断）：过去的事不提了。明天下午三点，老地方见。

电话挂断。林远盯着手机屏幕，眉头紧锁。

第二场 - 咖啡馆

林远提前十分钟到了咖啡馆。他选了一个靠窗的位置，可以看清门口进来的每一个人。

李明推门进来，径直走向林远的桌子。他看起来比上次见面苍老了一些。

李明：好久不见。

林远：确实。

两人沉默了几秒。服务员走过来，李明要了一杯美式。

李明：我知道你恨我。但这次我是认真的。

林远的嘴角露出一丝苦笑。"""

boundary = f"----WebKitFormBoundary{uuid.uuid4().hex[:16]}"
body = io.BytesIO()
body.write(f"--{boundary}\r\n".encode())
body.write(b'Content-Disposition: form-data; name="script"; filename="test.txt"\r\n')
body.write(b"Content-Type: text/plain\r\n\r\n")
body.write(script_content.encode("utf-8"))
body.write(f"\r\n--{boundary}--\r\n".encode())

req = urllib.request.Request(f"{BASE}/api/scripts/{pid}/upload", data=body.getvalue())
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
print("\n⏳ 正在调用 DeepSeek 解析剧本（可能需要 10-30 秒）...")
start = time.time()
resp = urllib.request.urlopen(req, timeout=120)
parsed = json.loads(resp.read())["parsed"]
elapsed = time.time() - start
print(f"✅ 剧本解析完成 ({elapsed:.1f}秒)")
print(f"   标题: {parsed['title']}")
print(f"   场次: {len(parsed['scenes'])}")
for s in parsed["scenes"]:
    print(f"     第{s['sceneId']}场: {s['location']} - {', '.join(s.get('characters', []))}")
print(f"   实体: {len(parsed['entities'])}")
for e in parsed["entities"]:
    bound = "✅" if e.get("bound") else "❌"
    print(f"     {bound} {e['name']} ({e['type']})")

# ============ 5. 生成分镜 ============
req = urllib.request.Request(f"{BASE}/api/storyboard/{pid}/generate", method="POST")
print("\n⏳ 正在调用 DeepSeek 生成分镜（可能需要 20-60 秒）...")
start = time.time()
resp = urllib.request.urlopen(req, timeout=180)
sb = json.loads(resp.read())
elapsed = time.time() - start
print(f"✅ 分镜生成完成 ({elapsed:.1f}秒)")
print(f"   总镜头: {len(sb['storyboard']['shots'])}")
for g in sb["groups"]:
    bridge = "🔗接点" if any(s.get("isBridgeShot") for s in g["shots"]) else ""
    print(f"     {g['groupId']}: {len(g['shots'])}镜头 {g['totalDuration']}秒 {bridge}")
print(f"   提示词组: {len(sb['prompts'])}")
for p in sb["prompts"]:
    refs = len(p.get("referenceImages", []))
    bridge_count = sum(1 for s in p["timelineShots"] if s.get("isBridge"))
    print(f"     {p['groupId']}: {len(p['timelineShots'])}镜头 参考图{refs}张 接点{bridge_count}个")

print("\n" + "=" * 50)
print("🎉 所有测试通过！DeepSeek LLM 已成功接入")
print("=" * 50)
