import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
    name: 'filter',
    pure: false
})
export class FilterArrayPipe implements PipeTransform {
    transform(value: any, filter: {[key: string]: string|boolean}, skipEmpty = false): any {
        if (filter && Array.isArray(value)) {
            const filterKeys = Object.keys(filter);
            return value.filter(item =>
                filterKeys.reduce((memo, keyName) => {
                    if (!filter[keyName] && skipEmpty) {
                        return true;
                    }
                    if (typeof filter[keyName] === 'string' && String(filter[keyName]).indexOf('-') === 0) {
                        return memo && item[keyName] !== String(filter[keyName]).replace('-', '');
                    } else {
                        return memo && item[keyName] === filter[keyName];
                    }
                }, true));
        } else {
            return value;
        }
    }
}

@Pipe({
    name: 'filterItems'
})
export class FilterItemsPipe implements PipeTransform {
    transform(items: any[], key: string, value: string) {
        if (key && value) {
            return items.filter(item => {
                return item[key].toUpperCase().indexOf(value.toUpperCase()) > -1;
            });
        } else {
            return items;
        }
    }
}
