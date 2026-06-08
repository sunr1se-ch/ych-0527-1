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

    combined = pd.concat([existing, new_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=['池号', '记录日期'], keep='last')
    combined = combined.sort_values(['池号', '记录日期'])

    save_records(combined)
    return len(new_df)


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
