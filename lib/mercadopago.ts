import { MercadoPagoConfig, Payment } from 'mercadopago';

// Configuração do Cliente
// Certifique-se que MP_ACCESS_TOKEN está no seu .env
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN || '' 
});

// Exporta a instância de pagamento para ser usada em webhooks
export const payment = new Payment(client);

// Função auxiliar para gerar o PIX
export async function gerarPix(
  valor: number, 
  descricao: string, 
  email: string, 
  externalId: string
) {
  try {
    const response = await payment.create({
      body: {
        transaction_amount: valor,
        description: descricao,
        payment_method_id: 'pix',
        payer: {
          email: email,
        },
        external_reference: externalId,
      }
    });

    return {
      id: response.id,
      qr_code: response.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      ticket_url: response.point_of_interaction?.transaction_data?.ticket_url,
      status: response.status
    };
  } catch (error) {
    console.error('Erro ao gerar PIX no Mercado Pago:', error);
    throw error;
  }
}