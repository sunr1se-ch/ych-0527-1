import os
import io
import csv
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd

from data_loader import (
    load_ponds,
    load_records,
    get_groups,
    get_date_range,
    calculate_daily_averages,
    calculate_period_averages,
    calculate_adjacent_ph_diff,
    append_records,
    get_group_layout,
    validate_record
)

app = Flask(__name__)
CORS(app)


def validate_date_range(start_date, end_date):
    if start_date and end_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            if start > end:
                return False, '起始日期不能大于结束日期'
        except ValueError:
            return False, '日期格式无效，请使用 YYYY-MM-DD 格式'
    return True, None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/groups', methods=['GET'])
def api_groups():
    groups = get_groups()
    return jsonify({
        'success': True,
        'data': groups
    })


@app.route('/api/date-range', methods=['GET'])
def api_date_range():
    start, end = get_date_range()
    return jsonify({
        'success': True,
        'data': {
            'min_date': start,
            'max_date': end
        }
    })


@app.route('/api/ponds', methods=['GET'])
def api_ponds():
    group = request.args.get('group')
    ponds = load_ponds()
    if group:
        ponds = ponds[ponds['所在组'] == group]
    return jsonify({
        'success': True,
        'data': ponds.to_dict('records')
    })


@app.route('/api/daily-averages', methods=['GET'])
def api_daily_averages():
    group = request.args.get('group')
    start_date = request.args.get('start_date') or request.args.get('startDate')
    end_date = request.args.get('end_date') or request.args.get('endDate')

    valid, error_msg = validate_date_range(start_date, end_date)
    if not valid:
        return jsonify({
            'success': False,
            'message': error_msg
        }), 400

    df = calculate_daily_averages(group, start_date, end_date)
    return jsonify({
        'success': True,
        'data': df.to_dict('records') if not df.empty else []
    })


@app.route('/api/period-averages', methods=['GET'])
def api_period_averages():
    group = request.args.get('group')
    start_date = request.args.get('start_date') or request.args.get('startDate')
    end_date = request.args.get('end_date') or request.args.get('endDate')

    valid, error_msg = validate_date_range(start_date, end_date)
    if not valid:
        return jsonify({
            'success': False,
            'message': error_msg
        }), 400

    df = calculate_period_averages(group, start_date, end_date)
    return jsonify({
        'success': True,
        'data': df.to_dict('records') if not df.empty else []
    })


@app.route('/api/adjacent-ph-diff', methods=['GET'])
def api_adjacent_ph_diff():
    group = request.args.get('group')
    start_date = request.args.get('start_date') or request.args.get('startDate')
    end_date = request.args.get('end_date') or request.args.get('endDate')

    valid, error_msg = validate_date_range(start_date, end_date)
    if not valid:
        return jsonify({
            'success': False,
            'message': error_msg
        }), 400

    df = calculate_adjacent_ph_diff(group, start_date, end_date)
    return jsonify({
        'success': True,
        'data': df.to_dict('records') if not df.empty else []
    })


@app.route('/api/group-layout', methods=['GET'])
def api_group_layout():
    layout = get_group_layout()
    return jsonify({
        'success': True,
        'data': layout
    })


@app.route('/api/records', methods=['POST'])
def api_add_records():
    try:
        data = request.get_json()
        if not data or 'records' not in data:
            return jsonify({
                'success': False,
                'message': '缺少records参数'
            }), 400

        records = data['records']
        if not isinstance(records, list) or len(records) == 0:
            return jsonify({
                'success': False,
                'message': '无有效记录，请至少提供一条记录'
            }), 400

        ponds_df = load_ponds()
        errors = []
        for i, record in enumerate(records):
            valid, error_msg = validate_record(record, ponds_df)
            if not valid:
                errors.append(f"第{i+1}条记录: {error_msg}")

        if errors:
            return jsonify({
                'success': False,
                'message': '数据校验失败',
                'errors': errors
            }), 400

        count = append_records(records)
        return jsonify({
            'success': True,
            'message': f'成功导入 {count} 条记录',
            'count': count
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@app.route('/api/import-csv', methods=['POST'])
def api_import_csv():
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': '没有上传文件'
            }), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': '文件名为空'
            }), 400

        if file and file.filename.endswith('.csv'):
            df = pd.read_csv(file, encoding='utf-8-sig')
            required_columns = ['池号', '记录日期', '实测液位厘米', 'pH', '表层盐花厚度毫米']
            for col in required_columns:
                if col not in df.columns:
                    return jsonify({
                        'success': False,
                        'message': f'缺少必要列: {col}'
                    }), 400

            if df.empty:
                return jsonify({
                    'success': False,
                    'message': 'CSV文件为空，无有效记录'
                }), 400

            ponds_df = load_ponds()
            records = df.to_dict('records')
            errors = []
            for i, record in enumerate(records):
                valid, error_msg = validate_record(record, ponds_df)
                if not valid:
                    errors.append(f"第{i+1}行: {error_msg}")

            if errors:
                return jsonify({
                    'success': False,
                    'message': '数据校验失败',
                    'errors': errors
                }), 400

            count = append_records(records)
            return jsonify({
                'success': True,
                'message': f'成功导入 {count} 条记录',
                'count': count
            })
        else:
            return jsonify({
                'success': False,
                'message': '请上传CSV文件'
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@app.route('/api/export', methods=['GET'])
def api_export():
    group = request.args.get('group')
    start_date = request.args.get('start_date') or request.args.get('startDate')
    end_date = request.args.get('end_date') or request.args.get('endDate')
    export_type = request.args.get('type', 'period')

    try:
        valid, error_msg = validate_date_range(start_date, end_date)
        if not valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400

        if export_type == 'period':
            df = calculate_period_averages(group, start_date, end_date)
            filename = f'期内统计_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        elif export_type == 'daily':
            df = calculate_daily_averages(group, start_date, end_date)
            filename = f'日均统计_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        elif export_type == 'adjacent':
            df = calculate_adjacent_ph_diff(group, start_date, end_date)
            filename = f'邻池pH差值_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        else:
            df = calculate_period_averages(group, start_date, end_date)
            filename = f'导出数据_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'

        if df.empty:
            return jsonify({
                'success': False,
                'message': '没有数据可导出'
            }), 400

        output = io.StringIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)

        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@app.route('/api/summary', methods=['GET'])
def api_summary():
    group = request.args.get('group')
    start_date = request.args.get('start_date') or request.args.get('startDate')
    end_date = request.args.get('end_date') or request.args.get('endDate')

    try:
        valid, error_msg = validate_date_range(start_date, end_date)
        if not valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400

        period_avg = calculate_period_averages(group, start_date, end_date)
        adjacent_diff = calculate_adjacent_ph_diff(group, start_date, end_date)

        summary = {
            'total_ponds': int(len(period_avg['池号'].unique())) if not period_avg.empty else 0,
            'total_records': int(period_avg['记录天数'].sum()) if not period_avg.empty else 0,
            'avg_ph': float(round(period_avg['期内pH均值'].mean(), 3)) if not period_avg.empty else 0.0,
            'avg_level': float(round(period_avg['期内液位均值'].mean(), 3)) if not period_avg.empty else 0.0,
            'max_ph_diff': float(round(adjacent_diff['pH差值'].max(), 3)) if not adjacent_diff.empty else 0.0,
            'avg_ph_diff': float(round(adjacent_diff['pH差值'].mean(), 3)) if not adjacent_diff.empty else 0.0,
            'date_range': {
                'start': start_date,
                'end': end_date
            }
        }

        return jsonify({
            'success': True,
            'data': summary
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
