"""探索 Seedance 视频生成 API 的参数格式"""
import urllib.request, json, sys
sys.stdout.reconfigure(encoding="utf-8")

API_BASE = "https://metamind.yun"
API_KEY = "sk-GGUj6MUyzlWWJGBvOAiy92NaZSDxzcdIdyA9tgwq94m0gyzO"

# 余额不够 ¥11.50, 试试用更小的设置
# 尝试不同参数组合

versions = [
    # (model, prompt, extra_params)
    ("seedance-2.0", "一个年轻人坐在办公桌前打字", {"size": "1536x1024", "duration": 5}),
    ("seed-2", "一个年轻人坐在办公桌前打字", {"size": "1536x1024"}),
    ("seed-2-fast", "一个年轻人坐在办公桌前打字", {}),
]

for model, prompt, extra in versions:
    body_data = {"model": model, "prompt": prompt, **extra}
    print(f"\n测试: {model} | {body_data}")
    
    body = json.dumps(body_data).encode()
    req = urllib.request.Request(f"{API_BASE}/v1/video/generations", data=body)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {API_KEY}")
    
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        print(f"  ✅ 状态码 {resp.status}")
        print(f"  响应: {json.dumps(result, indent=2, ensure_ascii=False)[:800]}")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  ❌ HTTP {e.code}: {error_body[:500]}")
    except Exception as e:
        print(f"  ❌ 异常: {e}")
