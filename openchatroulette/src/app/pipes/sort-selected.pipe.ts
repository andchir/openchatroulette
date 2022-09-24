import {Pipe, PipeTransform} from "@angular/core";

@Pipe({
    name: 'sortSelected'
})
export class SortSelectedPipe implements PipeTransform {
    transform(items: any[], key: string, value: string) {
        if (key && value) {
            const index = items.findIndex((item: any) => {
                return item[key] === value;
            });
            if (index > -1) {
                const selectedItem = items[index];
                return [selectedItem, ...items.slice(0, index), ...items.slice(index + 1)];
            } else {
                return items;
            }
        } else {
            return items;
        }
    }
}
