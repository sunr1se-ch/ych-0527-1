import sys
sys.path.insert(0, '.')

from data_loader import (
    load_ponds,
    load_records,
    get_groups,
    get_date_range,
    calculate_daily_averages,
    calculate_period_averages,
    calculate_adjacent_ph_diff,
    find_adjacent_ponds,
    get_group_layout
)

print('=== 测试核心业务逻辑 ===')

# 1. 测试数据加载
print('\n1. 测试数据加载...')
ponds = load_ponds()
print(f'   菜池档案: {len(ponds)} 条记录')
print(f'   列名: {list(ponds.columns)}')

records = load_records()
print(f'   每日记录: {len(records)} 条记录')
print(f'   列名: {list(records.columns)}')

# 2. 测试组别和日期范围
print('\n2. 测试基础查询...')
groups = get_groups()
print(f'   组别列表: {groups}')

min_date, max_date = get_date_range()
print(f'   日期范围: {min_date} ~ {max_date}')

# 3. 测试日均值计算
print('\n3. 测试日均值计算 (A组, 2026-06-01 ~ 2026-06-03)...')
daily_avg = calculate_daily_averages('A组', '2026-06-01', '2026-06-03')
print(f'   返回 {len(daily_avg)} 条日均值记录')
for _, row in daily_avg.head(5).iterrows():
    print(f'   {row["池号"]} {row["记录日期"]}: pH={row["pH"]:.2f}, 液位={row["实测液位厘米"]:.1f}cm')

# 4. 测试期内均值计算
print('\n4. 测试期内均值计算 (A组, 2026-06-01 ~ 2026-06-07)...')
period_avg = calculate_period_averages('A组', '2026-06-01', '2026-06-07')
print(f'   返回 {len(period_avg)} 条期内统计记录')
for _, row in period_avg.iterrows():
    print(f'   {row["池号"]}: pH均值={row["期内pH均值"]:.3f}, 液位均值={row["期内液位均值"]:.1f}cm, 记录天数={row["记录天数"]}')

# 5. 测试相邻池查找
print('\n5. 测试相邻池查找...')
for group in groups:
    adjacent = find_adjacent_ponds(group)
    print(f'   {group} 相邻池对: {len(adjacent)} 对')
    for pair in adjacent:
        print(f'     {pair["pool_1"]} <-> {pair["pool_2"]}')

# 6. 测试邻池pH差值计算
print('\n6. 测试邻池pH差值计算 (A组)...')
adjacent_diff = calculate_adjacent_ph_diff('A组', '2026-06-01', '2026-06-07')
print(f'   返回 {len(adjacent_diff)} 条差值记录')
for _, row in adjacent_diff.iterrows():
    print(f'   {row["池号1"]}({row["池1_pH均值"]:.3f}) vs {row["池号2"]}({row["池2_pH均值"]:.3f}): 差值={row["pH差值"]:.3f}')

# 7. 测试全部数据的邻池pH差值
print('\n7. 测试全部组邻池pH差值...')
all_diff = calculate_adjacent_ph_diff(None, '2026-06-01', '2026-06-07')
print(f'   返回 {len(all_diff)} 条差值记录')
print(f'   最大pH差值: {all_diff["pH差值"].max():.3f}')
print(f'   平均pH差值: {all_diff["pH差值"].mean():.3f}')

# 8. 测试池组布局
print('\n8. 测试池组布局...')
layout = get_group_layout()
for group, ponds_list in layout.items():
    print(f'   {group}: {[p["池号"] for p in ponds_list]}')

# 9. 测试汇总统计
print('\n9. 测试汇总统计...')
all_period_avg = calculate_period_averages(None, '2026-06-01', '2026-06-07')
all_adjacent_diff = calculate_adjacent_ph_diff(None, '2026-06-01', '2026-06-07')

print(f'   菜池总数: {len(all_period_avg["池号"].unique())}')
print(f'   记录总数: {all_period_avg["记录天数"].sum()}')
print(f'   平均pH: {all_period_avg["期内pH均值"].mean():.3f}')
print(f'   平均液位: {all_period_avg["期内液位均值"].mean():.1f}cm')
print(f'   最大pH差: {all_adjacent_diff["pH差值"].max():.3f}')
print(f'   平均pH差: {all_adjacent_diff["pH差值"].mean():.3f}')

print('\n=== 所有核心逻辑测试通过！ ===')
