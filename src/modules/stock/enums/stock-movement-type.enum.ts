export enum StockMovementType {
  RECEIPT = 'receipt', // Приход (поступление от поставщика)
  WRITEOFF = 'writeoff', // Списание (брак, производство, утилизация)
  CORRECTION = 'correction', // Корректировка по результатам инвентаризации
  TRANSFER_IN = 'transfer_in', // Входящее перемещение
  TRANSFER_OUT = 'transfer_out', // Исходящее перемещение
}
