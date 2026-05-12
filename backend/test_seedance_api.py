"""测试 Seedance 视频生成 API"""
import urllib.request, json, time, sys
sys.stdout.reconfigure(encoding="utf-8")

API_BASE = "https://metamind.yun"
API_KEY = "sk-GGUj6MUyzlWWJGBvOAiy92NaZSDxzcdIdyA9tgwq94m0gyzO"

# 测试1: 看看图片生成接口的文档/参数
# New API 是 OpenAI 兼容，图片生成用 /v1/images/generations
# seedance 可能也是这个接口，或者有自定义接口

# 先试试 images/generations
print("=" * 60)
print("测试1: POST /v1/images/generations (图片生成)")
print("=" * 60)

body = json.dumps({
    "model": "seedance-2.0",
    "prompt": "一个年轻人坐在办公桌前，表情焦虑，特写镜头",
    "n": 1,
    "size": "1536x1024"
}).encode()

req = urllib.request.Request(f"{API_BASE}/v1/images/generations", data=body)
req.add_header("Content-Type", "application/json")
req.add_header("Authorization", f"Bearer {API_KEY}")
try:
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())
    print("✅ 成功!")
    print(json.dumps(result, indent=2, ensure_ascii=False)[:1000])
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f"❌ 状态码: {e.code}")
    print(f"错误: {error_body[:500]}")
except Exception as e:
    print(f"❌ 异常: {e}")

# 测试2: 异步任务接口 - 看看有没有 /v1/tasks 或类似端点
print("\n" + "=" * 60)
print("测试2: 探索视频生成API（尝试不同的endpoint）")
print("=" * 60)

# 尝试一些常见的 video/image generation 端点
endpoints = [
    "/v1/video/generations",
    "/v1/videos/generations", 
    "/v1/tasks",
    "/v1/video/tasks",
]

for ep in endpoints:
    try:
        body = json.dumps({
            "model": "seedance-2.0",
            "prompt": "test"
        }).encode()
        req = urllib.request.Request(f"{API_BASE}{ep}", data=body)
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", f"Bearer {API_KEY}")
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        print(f"✅ {ep}: {json.dumps(result, ensure_ascii=False)[:300]}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"⚠️ {ep}: HTTP {e.code} - {body}")
    except Exception as e:
        print(f"⚠️ {ep}: {e}")
