import GC from '@spread';

import spreadConsts from './consts';
import { inDynamicTableArea, tableWithData } from './dynamicTable.util';

export const fieldSupportWidgetMap = {
    Whole: ['Checkbox', 'Cellphone', 'Number', 'SerialNumber'],
    Decimal: ['Checkbox', 'Cellphone', 'Number', 'SerialNumber'],
    String: ['Checkbox', 'Select', 'MultipleSelect', 'Cellphone', 'Email', 'Text', 'Date', 'Number', 'SerialNumber'],
    Date: ['Date', 'Text'],
    DateTime: ['Date', 'Text'],
};

/**
 * 获取范围(将-1替换成真实行列数)，4个值都有可能为-1
 * @param {GCTYPE.Spread.Sheets.Worksheet} sheet
 * @param {GCTYPE.Spread.Sheets.Range} range
 * @returns {GCTYPE.Spread.Sheets.Range}
 */
export function getActualRange(sheet, range) {
    const rowCount = sheet.getRowCount();
    const columnCount = sheet.getColumnCount();
    if (range.row === -1 && range.col === -1) {
        return new GC.Spread.Sheets.Range(0, 0, rowCount, columnCount);
    }
    if (range.row === -1) {
        return new GC.Spread.Sheets.Range(0, range.col, rowCount, range.colCount);
    }
    if (range.col === -1) {
        return new GC.Spread.Sheets.Range(range.row, 0, range.rowCount, columnCount);
    }
    return new GC.Spread.Sheets.Range(range.row, range.col, range.rowCount, range.colCount);
}

/**
 * 是否为单一合并态单元格
 * @param {GCTYPE.Spread.Sheets.Worksheet} sheet 表单
 * @param {Array.<GCTYPE.Spread.Sheets.Range>} ranges 范围列表
 * @returns {boolean}
 */
export function isSingleMergedCell(sheet, ranges) {
    if (ranges.length === 1) {
        const spans = sheet.getSpans(ranges[0]);
        if (spans.length === 1) {
            return spans[0].equals(getActualRange(sheet, ranges[0]));
        }
    }
    return false;
}

/**
 * 是否为单一单元格
 * @param {GCTYPE.Spread.Sheets.Worksheet} sheet 表单
 * @param {Array.<GCTYPE.Spread.Sheets.Range>} ranges 范围列表
 * @returns {boolean}
 */
export function isSingleCell(sheet, ranges) {
    if (ranges.length === 1) {
        return (ranges[0].rowCount === 1 && ranges[0].colCount === 1) || isSingleMergedCell(sheet, ranges);
    }
    return false;
}

/**
 * 是否为全行或全列
 *
 * @param {GCTYPE.Spread.Sheets.Worksheet} sheet 表单
 * @param {Array.<GCTYPE.Spread.Sheets.Range>} ranges 范围列表
 * @param {'row'|'col'} direction 行或列
 */
export function isFullRowOrCol(sheet, ranges, direction) {
    if (!Array.isArray(ranges)) {
        ranges = [ranges];
    }
    if (direction === 'row') {
        const colCount = sheet.getColumnCount();
        return ranges.every((range) => {
            if (range.col === -1) {
                return true;
            }
            return range.colCount === colCount && isSingleCell(sheet, [range]);
        });
    }
    const rowCount = sheet.getRowCount();
    return ranges.every((range) => {
        if (range.row === -1) {
            return true;
        }
        return range.rowCount === rowCount && isSingleCell(sheet, [range]);
    });
}

/**
 * 遍历单元格
 * @param {GCTYPE.Spread.Sheets.Range} range
 * @param {Function} cb
 * @param {Function} breakFn 中断函数
 * @returns {boolean} 是否成功遍历
 */
export function traverseCellRange(range, cb, breakFn) {
    const rowStart = range.row;
    const colStart = range.col;
    for (let i = 0; i < range.rowCount; i++) {
        for (let j = 0; j < range.colCount; j++) {
            if (!breakFn || !breakFn(rowStart + i, colStart + j)) {
                cb && cb(rowStart + i, colStart + j, i, j);
            } else {
                return false;
            }
        }
    }
    return true;
}

// 判断是否是合并单元格,如果是判断是否是合并单元格的起始格子,因为value默认在第一个单元格
export function isFirstCellInSpan(sheet, row, col) {
    const span = sheet.getSpan(row, col);
    if (!span || (row === span.row && col === span.col)) {
        return true;
    }
    return false;
}

export function getTagKeys(tag = {}) {
    const tagFilterKeys = ['toString', 'valueOf'];
    return Object.keys(tag).filter((key) => !tagFilterKeys.includes(key));
}

function getFieldTypesFromTag(tag, filterFieldIds = []) {
    const arr = [];
    if (tag && tag.tablesMap) {
        const tables = getTagKeys(tag.tablesMap);
        if (tables.length) {
            tables.forEach((tableName) => {
                const fieldMap = tag.tablesMap[tableName].fieldMap;
                const fieldNames = getTagKeys(fieldMap);
                fieldNames.forEach((filedName) => {
                    const fieldInfo = fieldMap[filedName];
                    if (fieldInfo && !filterFieldIds.includes(fieldInfo.id)) {
                        arr.push(fieldInfo.type);
                    }
                });
            });
        }
    }
    if (arr.length) {
        return arr;
    }
    return [];
}

export function getFieldTypeInRanges(sheet, ranges, filterFieldIds = []) {
    let types = [];
    ranges && ranges.forEach((range) => {
        if (sheet) {
            traverseCellRange(range, (row, col) => {
                if (isFirstCellInSpan(sheet, row, col)) {
                    const tag = sheet.getTag(row, col);
                    if (tag && tag.tablesMap) {
                        const fieldTypes = getFieldTypesFromTag(tag, filterFieldIds);
                        if (fieldTypes.length) {
                            types.push(...fieldTypes);
                        }
                    }
                }
            });
        }
    });
    types = Array.from(new Set(types));
    return types;
}

export function getWidgetList(sheet, sels) {
    const showWidgetList = isSingleCell(sheet, sels) || (!isFullRowOrCol(sheet, sels, 'row') && !isFullRowOrCol(sheet, sels, 'col'));
    const prevFieldTypes = getFieldTypeInRanges(sheet, sels);
    let widgetList = spreadConsts.widgetList;
    for (let i = 0; i < prevFieldTypes.length; i++) {
        widgetList = widgetList.filter((item) => fieldSupportWidgetMap[prevFieldTypes[i]].includes(item.type));
    }

    if (!inDynamicTableArea(sheet, sels) || tableWithData(sheet, sels)) {
        widgetList = widgetList.filter((w) => w.type !== 'SerialNumber');
    }
    return {
        showWidgetList,
        widgetList,
    };
}
