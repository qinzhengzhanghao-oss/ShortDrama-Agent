"""查询 New API 可用模型"""
import urllib.request, json

req = urllib.request.Request("https://metamind.yun/v1/models")
req.add_header("Authorization", "Bearer sk-GGUj6MUyzlWWJGBvOAiy92NaZSDxzcdIdyA9tgwq94m0gyzO")
resp = urllib.request.urlopen(req, timeout=15)
data = json.loads(resp.read())

models = data.get("data", [])
print(f"可用模型数: {len(models)}")
for m in models:
    mid = m.get("id", "?")
    print(f"  - {mid}")
