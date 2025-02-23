import { forwardRef, Inject, Injectable } from '@nestjs/common';
// import { CreateOrderDto } from './dto/create-order.dto';
// import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CancelAuthorizedByService } from 'src/cancel-authorized-by/cancel-authorized-by.service';
import { CanceledByService } from 'src/canceled-by/canceled-by.service';
import { CashiersService } from 'src/cashiers/cashiers.service';
import { CompanyService } from 'src/company/company.service';
import { CreatedByService } from 'src/created-by/created-by.service';
import { CustomerService } from 'src/customer/customer.service';
import { Order } from 'src/database/entities/order.entity';
import { DeliveryService } from 'src/delivery/delivery.service';
import { ItemsService } from 'src/items/items.service';
import { PaymentsService } from 'src/payments/payments.service';
import { SalesChannelService } from 'src/sales-channel/sales-channel.service';
import { TableService } from 'src/table/table.service';
import { TaxInvoiceService } from 'src/tax-invoice/tax-invoice.service';
import { TicketService } from 'src/ticket/ticket.service';
import { Repository } from 'typeorm';
import { Months } from 'src/utils/months';

/* eslint-disable */

@Injectable()
export class OrdersService {
    constructor(
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        private salesService: SalesChannelService,
        private companyService: CompanyService,
        @Inject(forwardRef(() => CashiersService))
        private cashierService: CashiersService,
        private paymentsService: PaymentsService,
        private itemsService: ItemsService,
        private customerService: CustomerService,
        private taxInvoiceService: TaxInvoiceService,
        private deliveryService: DeliveryService,
        private tableService: TableService,
        private ticketService: TicketService,
        private createdByService: CreatedByService,
        private canceledByService: CanceledByService,
        private cancelAuthorizedByService: CancelAuthorizedByService,
    ) { }

    async create(data) {
        for (const order of data) {
            const existingOrder = await this.orderRepository.findOneBy({
                stringOrder: order.id,
            });
            if (existingOrder) continue;

            let sales,
                company,
                cashier,
                customer,
                taxInvoice,
                delivery,
                table,
                ticket,
                createdBy,
                canceledBy,
                cancelAuthorizedBy;

            if (order.salesChannel)
                sales = await this.salesService.create(order.salesChannel);
            if (order.company)
                company = await this.companyService.create(order.company);
            if (order.cashier)
                cashier = await this.cashierService.createForOrder(
                    order.cashier,
                );
            if (order.customer)
                customer = await this.customerService.create(order.customer);
            if (order.taxInvoice)
                taxInvoice = await this.taxInvoiceService.create(
                    order.taxInvoice,
                );
            if (order.delivery)
                delivery = await this.deliveryService.create(order.delivery);
            if (order.table)
                table = await this.tableService.create(order.table);
            if (order.ticket)
                ticket = await this.ticketService.create(order.ticket);
            if (order.createdBy)
                createdBy = await this.createdByService.create(order.createdBy);
            if (order.canceledBy)
                canceledBy = await this.canceledByService.create(
                    order.canceledBy,
                );
            if (order.cancelAuthorizedBy)
                cancelAuthorizedBy =
                    await this.cancelAuthorizedByService.create(
                        order.cancelAuthorizedBy,
                    );

            const dataForOrder = this.orderRepository.create({
                status: order.status,
                type: order.type,
                code: order.code,
                salesChannel: sales,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                company: company,
                discount: order.discount,
                serviceCharge: order.serviceCharge,
                subtotal: order.subtotal,
                total: order.total,
                customer: customer,
                taxInvoice: taxInvoice,
                note: order.note,
                appVersion: order.appVersion,
                delivery: delivery,
                consumingMode: order.consumingMode,
                table: table,
                ticket: ticket,
                cashiers: cashier,
                createdBy: createdBy,
                canceledAt: order.canceledAt,
                canceledBy: canceledBy,
                cancelAuthorizedBy: cancelAuthorizedBy,
                stringOrder: order.id,
                responseOriginJson: order,
            });

            const createdOrder = await this.orderRepository.save(dataForOrder);

            for (const payment of order.payments) {
                this.paymentsService.create(payment, createdOrder.idOrders);
            }

            for (const item of order.items) {
                this.itemsService.create(item, createdOrder.idOrders);
            }
        }
    }

    /**
     * Função para pegar o faturamento total e mensal
     * @returns { number, number }
     */
    async getInvoicing() {
        const currentDate = new Date();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        let totalMonthSum: any = await this.querySum();
        let currentMonthSum: any = await this.querySum(month, year);

        return {
            totalSum: +totalMonthSum[0].sum,
            currentSum: +currentMonthSum[0].sum,
        };
    }

    /**
     * Função que retorna os faturamentos de cada mês deste ano e do ano passado
     * @returns { Array, Array }
     */
    async getMonthlyInvoicing() {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const previousYear = year - 1;

        let thisYearInvoicings: Array<any> = [];
        let lastYearInvoicings: Array<any> = [];

        for (let month = 0; month < 12; month++) {
            let title = `${Months[month]}`;

            let currentMonthSum: any = await this.querySum(month + 1, year);
            thisYearInvoicings.push({
                [title]: +currentMonthSum[0].sum,
            });

            let previousMonthSum: any = await this.querySum(
                month + 1,
                previousYear,
            );
            lastYearInvoicings.push({
                [title]: +previousMonthSum[0].sum,
            });
        }

        thisYearInvoicings.push({ year })
        lastYearInvoicings.push({ previousYear })

        return {
            thisYearInvoicings,
            lastYearInvoicings,
        };
    }

    /**
     * Função que busca a quantidade total e mensal de pedidos
     * @returns { number, number }
     */
    async getAllQtdOrders() {
        const currentDate = new Date();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        const totalQtdOrders = await this.queryCount();
        const currentQtdOrders = await this.queryCount(month, year);

        return {
            totalQtdOrders,
            currentQtdOrders,
        };
    }

    /**
     * Função para retornar o ticket total e mensal
     * @returns { number, number }
     */
    async getTicket() {
        const { currentQtdOrders, totalQtdOrders } = await this.getAllQtdOrders();
        const { currentSum, totalSum } = await this.getInvoicing();

        const currentTicket = totalSum / totalQtdOrders;
        const monthlyTicket = currentSum / currentQtdOrders;

        return {
            currentTicket,
            monthlyTicket,
        };
    }

    /**
     * Função para retornar dados de pedidos (quantidade, qtd de itens, faturamento total, ticket, tag do canal e porcentagem perante ao total de todos os canais) filtrados por canal
     * @returns { string, number, number, number, number. number }
     */
    async getOrdersByChannel() {
        const totalByChannel = await this.queryByChannel([
            'sale_channel.tag_salesChannel as channelTag, SUM(orders.total) as total, COUNT(DISTINCT orders.idOrders) as qtdOrders',
        ]);
        const itemsByChannel = await this.queryByChannel([
            'sale_channel.tag_salesChannel as channelTag, SUM(item.quantity_items) AS qtdItems, COUNT(DISTINCT orders.idOrders) as qtdOrders',
        ]);

        const totalSum = totalByChannel.reduce(
            (accumulator, channel) => accumulator + +channel.total,
            0,
        );

        const finalResult = totalByChannel.map((channel) => {
            const itemsData = itemsByChannel.find(
                (item) => item.channeltag === channel.channeltag,
            );

            return {
                channelTag: channel.channeltag,
                qtdItems: itemsData ? itemsData.qtditems : 0,
                qtdOrders: channel.qtdorders,
                total: channel.total,
                ticket: +channel.total / +channel.qtdorders,
                percent: totalSum > 0 ? (+channel.total / totalSum) * 100 : 0,
            };
        });

        return finalResult;
    }

    /**
     * Função para retornar a soma do valor total dos pedidos, podendo ser mensal ou de todos os registros (passe mês e ano no argumento se quer mensal)
     *
     * Vale ressaltar que a lógica para considerar um pedido é: ele não pode ter sido cancelado E seu pagamento precisa ser aprovado (pedidos com pagamentos em "awaiting" não entram na soma)
     */
    private async querySum(month?, year?) {
        const queryBuilder = this.orderRepository
            .createQueryBuilder('orders')
            .select(['SUM(orders.total)']);

        if (month && year) {
            queryBuilder
                .where('EXTRACT(MONTH FROM orders.updatedAt) = :month', {
                    month,
                })
                .andWhere('EXTRACT(YEAR FROM orders.updatedAt) = :year', {
                    year,
                });
        }

        queryBuilder
            .andWhere('orders.status != :status', { status: 'canceled' })
            .innerJoin(
                'payments',
                'payment',
                'payment.orderId = orders.idOrders',
            )
            .andWhere('payment.status_payments = :paymentStatus', {
                paymentStatus: 'approved',
            });

        return queryBuilder.getRawMany();
    }

    /**
     * Função para retornar a contagem de pedidos feitos, podendo ser mensal ou de todos os registros (passe mês e ano no argumento se quer mensal)
     *
     * A lógica para considerar um pedido é: ele não pode ter sido cancelado E seu pagamento precisa ser aprovado (pedidos com pagamentos em "awaiting" não entram na soma)
     */
    private async queryCount(month?, year?) {
        const queryBuilder = this.orderRepository
            .createQueryBuilder('orders')
            .select(['orders.id']);

        if (month && year) {
            queryBuilder
                .where('EXTRACT(MONTH FROM orders.updatedAt) = :month', {
                    month,
                })
                .andWhere('EXTRACT(YEAR FROM orders.updatedAt) = :year', {
                    year,
                });
        }

        queryBuilder
            .andWhere('orders.status != :status', { status: 'canceled' })
            .innerJoin(
                'payments',
                'payment',
                'payment.orderId = orders.idOrders',
            )
            .andWhere('payment.status_payments = :paymentStatus', {
                paymentStatus: 'approved',
            });

        return queryBuilder.getCount();
    }

    /**
     * Função para retornar dados agrupados por canal, os dados retornado da consulta varia do que é passado no parâmetro, buscas com itens tem a consulta modificada
     *
     * A lógica para considerar um pedido é: ele não pode ter sido cancelado E seu pagamento precisa ser aprovado (pedidos com pagamentos em "awaiting" não entram na soma)
     *
     * A lógica para considerar um item é: ele não pode ter "typeCombo", ou seja, ser um combo (pois já contamos os itens de um combo separadamente)
     */
    private async queryByChannel(params: Array<string>) {
        const queryBuilder = this.orderRepository
            .createQueryBuilder('orders')
            .select(params)
            .where('orders.status != :status', { status: 'canceled' })
            .andWhere('payment.status_payments = :paymentStatus', {
                paymentStatus: 'approved',
            })
            .innerJoin(
                'sales_channel',
                'sale_channel',
                'orders.salesChannel = sale_channel.idsalesChannel',
            )
            .groupBy('sale_channel.tag_salesChannel');

        if (params.some((param) => param.includes('item'))) {
            queryBuilder
                .leftJoin('items', 'item', 'item.idOrders = orders.idOrders')
                .andWhere('item.comboType IS NULL');
        }

        queryBuilder.leftJoin(
            'payments',
            'payment',
            'payment.orderId = orders.idOrders',
        );

        return await queryBuilder.getRawMany();
    }
}
