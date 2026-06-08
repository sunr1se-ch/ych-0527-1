import urllib.request
import urllib.parse
import json

BASE_URL = 'http://localhost:5000'

def test_api(endpoint, description):
    print(f'\n=== {description} ===')
    try:
        url = f'{BASE_URL}{endpoint}'
        url = urllib.parse.quote(url, safe='/:?=&')
        resp = urllib.request.urlopen(url)
        data = json.loads(resp.read())
        if data.get('success'):
            print('[OK] 成功')
            return data['data']
        else:
            print(f'[FAIL] 失败: {data.get("message")}')
            return None
    except Exception as e:
        print(f'[ERROR] 异常: {e}')
        return None

if __name__ == '__main__':
    print('开始测试API接口...')
    
    # 1. 获取组别列表
    groups = test_api('/api/groups', '获取组别列表')
    if groups:
        print(f'  组别: {groups}')
    
    # 2. 获取日期范围
    date_range = test_api('/api/date-range', '获取日期范围')
    if date_range:
        print(f'  最小日期: {date_range["min_date"]}, 最大日期: {date_range["max_date"]}')
    
    # 3. 获取池组布局
    layout = test_api('/api/group-layout', '获取池组布局')
    if layout:
        for group, ponds in layout.items():
            print(f'  {group}: {[p["池号"] for p in ponds]}')
    
    # 4. 获取A组期内均值统计
    period_avg = test_api('/api/period-averages?group=A组&start_date=2026-06-01&end_date=2026-06-07', '获取A组期内均值统计')
    if period_avg:
        for item in period_avg:
            print(f'  池号: {item["池号"]}, pH均值: {item["期内pH均值"]}, 液位均值: {item["期内液位均值"]}')
    
    # 5. 获取A组邻池pH差值
    adjacent_diff = test_api('/api/adjacent-ph-diff?group=A组&start_date=2026-06-01&end_date=2026-06-07', '获取A组邻池pH差值')
    if adjacent_diff:
        for item in adjacent_diff:
            print(f'  {item["池号1"]} vs {item["池号2"]}: pH差值 = {item["pH差值"]}')
    
    # 6. 获取汇总统计
    summary = test_api('/api/summary?start_date=2026-06-01&end_date=2026-06-07', '获取汇总统计')
    if summary:
        print(f'  菜池总数: {summary["total_ponds"]}')
        print(f'  记录总数: {summary["total_records"]}')
        print(f'  平均pH: {summary["avg_ph"]}')
        print(f'  平均液位: {summary["avg_level"]}')
        print(f'  最大pH差: {summary["max_ph_diff"]}')
        print(f'  平均pH差: {summary["avg_ph_diff"]}')
    
    # 7. 获取日均值数据
    daily_avg = test_api('/api/daily-averages?group=A组&start_date=2026-06-01&end_date=2026-06-03', '获取A组前3天日均值')
    if daily_avg:
        print(f'  返回 {len(daily_avg)} 条日均值记录')
        for item in daily_avg[:3]:
            print(f'    {item["池号"]} {item["记录日期"]}: pH={item["pH"]}, 液位={item["实测液位厘米"]}')
    
    print('\n[DONE] 所有API测试完成！')
