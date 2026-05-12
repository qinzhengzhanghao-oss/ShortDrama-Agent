"""测试 Seedance 任务轮询（加更多细节）"""
import urllib.request, json, time, sys
sys.stdout.reconfigure(encoding="utf-8")

API_BASE = "https://metamind.yun"
API_KEY = "sk-GGUj6MUyzlWWJGBvOAiy92NaZSDxzcdIdyA9tgwq94m0gyzO"

# Step 1: Try submitting with minimal params
body_data = {
    "model": "seed-2-fast",
    "prompt": "一个年轻人坐在办公桌前，表情焦虑",
}

print(f"提交任务: {body_data}")
body = json.dumps(body_data).encode()
req = urllib.request.Request(f"{API_BASE}/v1/video/generations", data=body)
req.add_header("Content-Type", "application/json")
req.add_header("Authorization", f"Bearer {API_KEY}")

resp = urllib.request.urlopen(req, timeout=30)
result = json.loads(resp.read())
print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")

task_id = result.get("task_id") or result.get("id")
if not task_id:
    print("没有 task_id")
    exit()

# Step 2: Poll the task
print(f"\n轮询任务: {task_id}")
for i in range(20):
    time.sleep(5)
    
    get_req = urllib.request.Request(f"{API_BASE}/v1/video/tasks/{task_id}")
    get_req.add_header("Authorization", f"Bearer {API_KEY}")
    
    try:
        resp = urllib.request.urlopen(get_req, timeout=15)
        status = json.loads(resp.read())
        s = status.get("status", "?")
        p = status.get("progress", 0)
        print(f"  [{i*5}s] {s} | {p}%")
        
        if s in ("completed", "failed", "error", "succeeded"):
            print(f"\n最终结果:")
            print(json.dumps(status, indent=2, ensure_ascii=False)[:2000])
            break
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  HTTP {e.code}: {err[:300]}")
        break
