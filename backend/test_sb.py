"""测试分镜生成"""
import urllib.request, json, uuid, io, time, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "http://localhost:3000"

# 创建项目
body = json.dumps({"name": "分镜测试", "style": "真人"}).encode()
req = urllib.request.Request(f"{BASE}/api/projects", data=body, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
pid = json.loads(resp.read())["project"]["id"]
print(f"项目: {pid}")

# 上传一个简单测试剧本
script = """第一场 - 办公室
李明：这次裁员名单里有你。
林远：我明白了。"""

boundary = f"----{uuid.uuid4().hex[:16]}"
body = io.BytesIO()
body.write(f"--{boundary}\r\n".encode())
body.write(b'Content-Disposition: form-data; name="script"; filename="t.txt"\r\n')
body.write(b"Content-Type: text/plain\r\n\r\n")
body.write(script.encode("utf-8"))
body.write(f"\r\n--{boundary}--\r\n".encode())

req = urllib.request.Request(f"{BASE}/api/scripts/{pid}/upload", data=body.getvalue())
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
resp = urllib.request.urlopen(req, timeout=60)
parsed = json.loads(resp.read())
print(f"剧本解析: 场次{len(parsed['parsed']['scenes'])}")

# 生成分镜
req = urllib.request.Request(f"{BASE}/api/storyboard/{pid}/generate", method="POST")
try:
    resp = urllib.request.urlopen(req, timeout=180)
    sb = json.loads(resp.read())
    print(f"分镜生成: {len(sb['storyboard']['shots'])}镜头, {len(sb['groups'])}组, {len(sb['prompts'])}提示词")
    print("✅ 成功!")
except urllib.error.HTTPError as e:
    print(f"❌ 状态码: {e.code}")
    # 读取错误详情
    detail = e.read().decode()
    print(f"错误: {detail[:500]}")
