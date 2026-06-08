import sys
sys.path.insert(0, '.')
from data_loader import calculate_period_averages, calculate_adjacent_ph_diff

print('Testing with empty group...')
try:
    period_avg = calculate_period_averages('', '2026-06-01', '2026-06-07')
    print(f'period_avg shape: {period_avg.shape}')
    print(f'period_avg columns: {list(period_avg.columns)}')
    print(f'total_ponds: {len(period_avg["池号"].unique())}')
    print(f'total_records: {period_avg["记录天数"].sum()}')
    print(f'avg_ph: {period_avg["期内pH均值"].mean()}')
    
    adjacent_diff = calculate_adjacent_ph_diff('', '2026-06-01', '2026-06-07')
    print(f'adjacent_diff shape: {adjacent_diff.shape}')
    print(f'max_ph_diff: {adjacent_diff["pH差值"].max()}')
    print(f'avg_ph_diff: {adjacent_diff["pH差值"].mean()}')
    
    print('\nAll calculations successful!')
    
    # Now test with None group
    print('\n\nTesting with None group...')
    period_avg2 = calculate_period_averages(None, '2026-06-01', '2026-06-07')
    print(f'period_avg shape: {period_avg2.shape}')
    
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
