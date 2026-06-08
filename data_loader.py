import os
import pandas as pd
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
PONDS_FILE = os.path.join(DATA_DIR, 'ponds.csv')
RECORDS_FILE = os.path.join(DATA_DIR, 'records.csv')


def load_ponds():
    df = pd.read_csv(PONDS_FILE, encoding='utf-8-sig')
    return df


def load_records():
    df = pd.read_csv(RECORDS_FILE, encoding='utf-8-sig')
    df['记录日期'] = pd.to_datetime(df['记录日期'])
    return df


def save_records(df):
    df['记录日期'] = pd.to_datetime(df['记录日期']).dt.strftime('%Y-%m-%d')
    df.to_csv(RECORDS_FILE, index=False, encoding='utf-8-sig')


def get_groups():
    ponds = load_ponds()
    return sorted(ponds['所在组'].unique().tolist())


def get_ponds_by_group(group_name=None):
    ponds = load_ponds()
    if group_name:
        ponds = ponds[ponds['所在组'] == group_name]
    return ponds


def get_date_range():
    records = load_records()
    if records.empty:
        return None, None
    return records['记录日期'].min().strftime('%Y-%m-%d'), records['记录日期'].max().strftime('%Y-%m-%d')


def calculate_daily_averages(group_name=None, start_date=None, end_date=None):
    records = load_records()
    ponds = load_ponds()

    if records.empty:
        return pd.DataFrame()

    if start_date:
        records = records[records['记录日期'] >= pd.to_datetime(start_date)]
    if end_date:
        records = records[records['记录日期'] <= pd.to_datetime(end_date)]

    if group_name:
        group_ponds = ponds[ponds['所在组'] == group_name]['池号'].tolist()
        records = records[records['池号'].isin(group_ponds)]

    daily_avg = records.groupby(['池号', '记录日期']).agg({
        '实测液位厘米': 'mean',
        'pH': 'mean',
        '表层盐花厚度毫米': 'mean'
    }).reset_index()

    daily_avg = daily_avg.merge(ponds, on='池号', how='left')
    daily_avg['记录日期'] = daily_avg['记录日期'].dt.strftime('%Y-%m-%d')

    return daily_avg


def calculate_period_averages(group_name=None, start_date=None, end_date=None):
    daily_avg = calculate_daily_averages(group_name, start_date, end_date)

    if daily_avg.empty:
        return pd.DataFrame()

    period_avg = daily_avg.groupby(['池号', '所在组', '设计液位厘米']).agg({
        '实测液位厘米': 'mean',
        'pH': 'mean',
        '表层盐花厚度毫米': 'mean',
        '记录日期': 'count'
    }).reset_index()

    period_avg.rename(columns={
        '实测液位厘米': '期内液位均值',
        'pH': '期内pH均值',
        '表层盐花厚度毫米': '期内盐花厚度均值',
        '记录日期': '记录天数'
    }, inplace=True)

    period_avg = period_avg.round(3)
    return period_avg


def find_adjacent_ponds(group_name):
    ponds = get_ponds_by_group(group_name)
    if ponds.empty:
        return []

    pond_list = sorted(ponds['池号'].tolist())
    adjacent_pairs = []

    for i in range(len(pond_list) - 1):
        adjacent_pairs.append({
            'pool_1': pond_list[i],
            'pool_2': pond_list[i + 1],
            'group': group_name
        })

    return adjacent_pairs


def calculate_adjacent_ph_diff(group_name=None, start_date=None, end_date=None):
    period_avg = calculate_period_averages(group_name, start_date, end_date)

    if period_avg.empty:
        return pd.DataFrame()

    results = []
    groups = period_avg['所在组'].unique().tolist() if not group_name else [group_name]

    for grp in groups:
        adjacent_pairs = find_adjacent_ponds(grp)
        grp_data = period_avg[period_avg['所在组'] == grp]

        for pair in adjacent_pairs:
            p1_data = grp_data[grp_data['池号'] == pair['pool_1']]
            p2_data = grp_data[grp_data['池号'] == pair['pool_2']]

            if not p1_data.empty and not p2_data.empty:
                ph1 = p1_data['期内pH均值'].values[0]
                ph2 = p2_data['期内pH均值'].values[0]
                results.append({
                    '组号': grp,
                    '池号1': pair['pool_1'],
                    '池号2': pair['pool_2'],
                    '池1_pH均值': ph1,
                    '池2_pH均值': ph2,
                    'pH差值': round(abs(ph1 - ph2), 3),
                    '记录天数': min(p1_data['记录天数'].values[0], p2_data['记录天数'].values[0])
                })

    return pd.DataFrame(results)


def append_records(new_records):
    existing = load_records()
    new_df = pd.DataFrame(new_records)
    new_df['记录日期'] = pd.to_datetime(new_df['记录日期'])

    key_cols = ['池号', '记录日期']
    value_cols = ['实测液位厘米', 'pH', '表层盐花厚度毫米']

    new_count = 0
    update_count = 0

    for _, new_row in new_df.iterrows():
        key_mask = (existing['池号'] == new_row['池号']) & (existing['记录日期'] == new_row['记录日期'])
        existing_row = existing[key_mask]

        if existing_row.empty:
            new_count += 1
        else:
            is_different = False
            for col in value_cols:
                if col in new_row and col in existing_row.columns:
                    existing_val = existing_row[col].values[0]
                    new_val = new_row[col]
                    if pd.notna(new_val) and abs(float(existing_val) - float(new_val)) > 1e-9:
                        is_different = True
                        break
            if is_different:
                update_count += 1

    combined = pd.concat([existing, new_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=key_cols, keep='last')
    combined = combined.sort_values(key_cols)

    save_records(combined)
    return new_count + update_count


def validate_record(record, ponds_df=None):
    if ponds_df is None:
        ponds_df = load_ponds()

    valid_ponds = ponds_df['池号'].tolist()

    if '池号' not in record or not record['池号']:
        return False, '缺少池号'
    if record['池号'] not in valid_ponds:
        return False, f"池号 {record['池号']} 不存在于菜池档案中"

    if '记录日期' not in record or not record['记录日期']:
        return False, '缺少记录日期'
    try:
        pd.to_datetime(record['记录日期'])
    except Exception:
        return False, f"记录日期 {record['记录日期']} 格式无效"

    if 'pH' not in record or record['pH'] is None or (isinstance(record['pH'], str) and record['pH'].strip() == ''):
        return False, '缺少pH值'
    try:
        ph = float(record['pH'])
        if ph < 0 or ph > 14:
            return False, f"pH值 {ph} 超出有效范围 (0-14)"
    except (ValueError, TypeError):
        return False, f"pH值 {record['pH']} 不是有效数字"

    if '实测液位厘米' not in record or record['实测液位厘米'] is None or (isinstance(record['实测液位厘米'], str) and record['实测液位厘米'].strip() == ''):
        return False, '缺少实测液位厘米'
    try:
        level = float(record['实测液位厘米'])
        if level <= 0:
            return False, f"实测液位厘米 {level} 必须大于0"
        if level > 300:
            return False, f"实测液位厘米 {level} 超出合理范围 (最大300)"
    except (ValueError, TypeError):
        return False, f"实测液位厘米 {record['实测液位厘米']} 不是有效数字"

    if '表层盐花厚度毫米' not in record or record['表层盐花厚度毫米'] is None or (isinstance(record['表层盐花厚度毫米'], str) and record['表层盐花厚度毫米'].strip() == ''):
        return False, '缺少表层盐花厚度毫米'
    try:
        salt = float(record['表层盐花厚度毫米'])
        if salt < 0:
            return False, f"表层盐花厚度毫米 {salt} 不能为负数"
        if salt > 100:
            return False, f"表层盐花厚度毫米 {salt} 超出合理范围 (最大100)"
    except (ValueError, TypeError):
        return False, f"表层盐花厚度毫米 {record['表层盐花厚度毫米']} 不是有效数字"

    return True, None


def get_group_layout():
    ponds = load_ponds()
    groups = {}

    for _, row in ponds.iterrows():
        group = row['所在组']
        if group not in groups:
            groups[group] = []
        groups[group].append({
            '池号': row['池号'],
            '设计液位厘米': row['设计液位厘米']
        })

    for group in groups:
        groups[group] = sorted(groups[group], key=lambda x: x['池号'])

    return groups
