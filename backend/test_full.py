"""全流程完整测试"""
import urllib.request, json, uuid, io, time, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "http://localhost:3000"

# 1. 创建项目
body = json.dumps({"name": "全流程测试", "style": "真人"}).encode()
req = urllib.request.Request(f"{BASE}/api/projects", data=body, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
pid = json.loads(resp.read())["project"]["id"]
print(f"✅ 项目: {pid}")

# 2. 创建资产
for etype, ename in [("characters","林远"),("characters","李明"),("characters","张伟"),("scenes","办公室"),("scenes","咖啡馆")]:
    body = json.dumps({"name": ename}).encode()
    req = urllib.request.Request(f"{BASE}/api/assets/{pid}/{etype}", data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    print(f"✅ {etype}: {ename}")

# 3. 上传剧本
script = """第一场 - 深夜办公室
林远坐在电脑前，屏幕的蓝光映在他疲惫的脸上。
电话铃声突然响起。林远看了一眼来电显示，犹豫了一下，接起电话。
李明（电话里）：林远，我是李明。听说你在做新方案？我想跟你谈谈合作的事。
林远（警惕地）：李总？您不是已经……
李明（打断）：过去的事不提了。明天下午三点，老地方见。
电话挂断。林远盯着手机屏幕，眉头紧锁。

第二场 - 咖啡馆
林远提前十分钟到了咖啡馆。他选了一个靠窗的位置。
李明推门进来，径直走向林远的桌子。
李明：好久不见。
林远：确实。
两人沉默了几秒。李明要了一杯美式。
李明：我知道你恨我。但这次我是认真的。
"""

boundary = f"----{uuid.uuid4().hex[:16]}"
body = io.BytesIO()
body.write(f"--{boundary}\r\n".encode())
body.write(b'Content-Disposition: form-data; name="script"; filename="test.txt"\r\n')
body.write(b"Content-Type: text/plain\r\n\r\n")
body.write(script.encode("utf-8"))
body.write(f"\r\n--{boundary}--\r\n".encode())

req = urllib.request.Request(f"{BASE}/api/scripts/{pid}/upload", data=body.getvalue())
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
print("\n⏳ LLM 解析剧本...")
t0 = time.time()
resp = urllib.request.urlopen(req, timeout=60)
parsed = json.loads(resp.read())["parsed"]
print(f"✅ 解析完成 ({time.time()-t0:.1f}s): {len(parsed['scenes'])}场, {len(parsed['entities'])}实体")

# 4. 生成分镜
req = urllib.request.Request(f"{BASE}/api/storyboard/{pid}/generate", method="POST")
print("\n⏳ LLM 生成分镜...")
t0 = time.time()
resp = urllib.request.urlopen(req, timeout=180)
sb = json.loads(resp.read())
print(f"✅ 分镜完成 ({time.time()-t0:.1f}s): {len(sb['storyboard']['shots'])}镜头, {len(sb['groups'])}组")
for g in sb["groups"]:
    bridge = "🔗" if any(s.get("isBridgeShot") for s in g["shots"]) else ""
    print(f"   {g['groupId']}: {len(g['shots'])}镜头 {g['totalDuration']}秒 {bridge}")
print(f"   提示词: {len(sb['prompts'])}组")

# 验证提示词格式
for p in sb["prompts"]:
    print(f"\n   {p['groupId']}:")
    print(f"     镜头数: {len(p['timelineShots'])}")
    print(f"     参考图: {len(p['referenceImages'])}张")
    bridge_shots = [s for s in p["timelineShots"] if s.get("isBridge")]
    if bridge_shots:
        print(f"     接点镜头: {[s['shotId'] for s in bridge_shots]}")
    locked = "🔒" if p.get("bridgePrompt") else ""
    print(f"     提示词预览: {p['prompt'][:100]}...{locked}")

print(f"\n{'='*50}")
print(f"🎉 全流程测试通过!")
print(f"   DeepSeek 已成功接入")
print(f"   剧本解析 ✅ 分镜生成 ✅ 提示词 ✅")
print(f"{'='*50}")
