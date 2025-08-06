/**
 * Вспомогательные функции и mock данные для тестирования модуля ФНС
 * Основано на примерах из документации ФНС API
 */

// QR данные из документации ФНС
export const EXAMPLE_QR_DATA = {
  fn: '9287440300090728',
  fd: '77133',
  fp: '1482926127',
  sum: 240000, // 2400 рублей в копейках
  date: '2019-04-09T16:38:00',
  typeOperation: 1
};

// Токены из документации
export const EXAMPLE_TOKENS = {
  masterToken: 'LFgDIA4yBZjW6h174iwVDcRoDHhjmpuFLtAX3kHPT9ctgggajk36aLJIzIcs2kZyKvTqLy4rSEHi7KOgY0fuNHKPbGCekDg9qjpin04K4ZyfolqtwDBZ6f6Isja3MMWe',
  sessionToken: 'c499717f309949d2b8719bf3040efd96',
  testToken: '4541'
};

// MessageId из документации
export const EXAMPLE_MESSAGE_IDS = {
  success: 'd28f1970-1e8d-4fe4-8a39-8aab0af7885e',
  processing: '22cf901c-0ca8-4c01-befc-99f30bc005f0',
  completed: '352398b9-9bec-45cf-942e-92f45ae512b5',
  notFound: '5c3da8d7-cb72-4c4f-b4b8-aafbd1d1ef46'
};

// SOAP ответы из документации
export const SOAP_RESPONSES = {
  authSuccess: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <GetMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiMessageConsumerService/types/1.0">
        <Message>
          <AuthResponse xmlns:ns3="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageProviderService/types/1.0" 
                       xmlns:ns2="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0" 
                       xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
                       xmlns="urn://x-artefacts-gnivc-ru/ais3/kkt/AuthService/types/1.0">
            <ns2:Result>
              <ns2:Token>c499717f309949d2b8719bf3040efd96</ns2:Token>
              <ns2:ExpireTime>2021-01-21T14:52:13.202+03:00</ns2:ExpireTime>
            </ns2:Result>
          </AuthResponse>
        </Message>
      </GetMessageResponse>
    </soap:Body>
  </soap:Envelope>`,

  sendMessageSuccess: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <SendMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
        <MessageId>d28f1970-1e8d-4fe4-8a39-8aab0af7885e</MessageId>
      </SendMessageResponse>
    </soap:Body>
  </soap:Envelope>`,

  getMessageProcessing: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <GetMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
        <ProcessingStatus>PROCESSING</ProcessingStatus>
      </GetMessageResponse>
    </soap:Body>
  </soap:Envelope>`,

  getMessageCompleted: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <GetMessageResponse xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
        <ProcessingStatus>COMPLETED</ProcessingStatus>
        <Message>
          <GetTicketResponse xmlns:ns3="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageProviderService/types/1.0" 
                            xmlns:ns2="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0" 
                            xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
                            xmlns="urn://x-artefacts-gnivc-ru/ais3/kkt/KktTicketService/types/1.0">
            <ns2:Result>
              <ns2:Code>200</ns2:Code>
              <ns2:Ticket>{"id":3474433105673519104,"ofdId":"ofd9","fiscalDocumentNumber":77133,"totalSum":240000}</ns2:Ticket>
            </ns2:Result>
          </GetTicketResponse>
        </Message>
      </GetMessageResponse>
    </soap:Body>
  </soap:Envelope>`
};

// SOAP ошибки из документации
export const SOAP_ERRORS = {
  timeout: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <soap:Fault>
        <faultcode>soap:Server</faultcode>
        <faultstring>Произошел timeout ожидания ответа</faultstring>
      </soap:Fault>
    </soap:Body>
  </soap:Envelope>`,

  ipBlocked: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <soap:Fault>
        <faultcode>soap:Server</faultcode>
        <faultstring>Доступ к сервису для переданного IP, запрещен</faultstring>
      </soap:Fault>
    </soap:Body>
  </soap:Envelope>`,

  tokenDenied: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <soap:Fault>
        <faultcode>soap:Server</faultcode>
        <faultstring>Доступ к сервису для token запрещен</faultstring>
        <detail>
          <AuthenticationFault xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0"/>
        </detail>
      </soap:Fault>
    </soap:Body>
  </soap:Envelope>`,

  dailyLimitExceeded: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <soap:Fault>
        <faultcode>soap:Server</faultcode>
        <faultstring>Превышен общий дневной лимит запросов, приложением TestAppId-1</faultstring>
      </soap:Fault>
    </soap:Body>
  </soap:Envelope>`,

  messageNotFound: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <soap:Fault>
        <faultcode>soap:Server</faultcode>
        <faultstring>По переданному MessageId: 5c3da8d7-cb72-4c4f-b4b8-aafbd1d1ef46 сообщение не найдено</faultstring>
        <detail>
          <MessageNotFoundFault xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0"/>
        </detail>
      </soap:Fault>
    </soap:Body>
  </soap:Envelope>`,

  rateLimiting: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <soap:Fault>
        <faultcode>soap:Server</faultcode>
        <faultstring>Превышено количество запросов метода GetMessage по уникальному MessageID. Повторите запрос позже.</faultstring>
        <detail>
          <RateLimitingFault xmlns="urn://x-artefacts-gnivc-ru/inplat/servin/OpenApiAsyncMessageConsumerService/types/1.0">
            <errorCode>429</errorCode>
          </RateLimitingFault>
        </detail>
      </soap:Fault>
    </soap:Body>
  </soap:Envelope>`
};

// Функции для создания mock данных
export function createMockAxiosResponse(data: string, status = 200) {
  return {
    status,
    data,
    headers: {
      'content-type': 'text/xml; charset=UTF-8',
      'server': 'Jetty(9.2.21.v20170120)'
    }
  };
}

export function createMockAxiosError(data: string, status = 500) {
  return {
    response: {
      status,
      data,
      headers: {
        'content-type': 'text/xml; charset=UTF-8'
      }
    }
  };
}

// Mock данные для базы данных
export function createMockFnsRequest(overrides = {}) {
  return {
    id: `request-${Date.now()}`,
    status: 'pending',
    qrData: EXAMPLE_QR_DATA,
    messageId: null,
    cashbackAmount: 0,
    cashbackAwarded: false,
    isValid: null,
    isReturn: false,
    isFake: false,
    attempts: 0,
    lastAttemptAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customerId: 1,
    promotionId: null,
    ...overrides
  };
}

export function createMockPromotion(overrides = {}) {
  return {
    id: 1,
    promotionId: 'test-promo-id',
    name: 'Test Pharmacy Network',
    domain: 'test-pharmacy.ru',
    active: true,
    cashbackPercent: 5,
    maxCashbackPerReceipt: 1000,
    dailyLimit: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export function createMockCustomer(overrides = {}) {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    phone: '+7 900 123 45 67',
    balance: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// Утилиты для тестирования
export function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMockLogger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  };
}

// Валидаторы для SOAP запросов
export function validateSoapRequest(soapXml: string) {
  const requiredElements = [
    'soap-env:Envelope',
    'soap-env:Body',
    'ns0:SendMessageRequest',
    'tns:GetTicketRequest',
    'tns:GetTicketInfo'
  ];

  for (const element of requiredElements) {
    if (!soapXml.includes(element)) {
      throw new Error(`Missing required SOAP element: ${element}`);
    }
  }

  return true;
}

export function validateSoapHeaders(headers: Record<string, string>) {
  const requiredHeaders = [
    'Content-Type',
    'SOAPAction',
    'FNS-OpenApi-Token'
  ];

  for (const header of requiredHeaders) {
    if (!headers[header]) {
      throw new Error(`Missing required header: ${header}`);
    }
  }

  // Проверяем, что deprecated заголовок не используется
  if (headers['FNS-OpenApi-UserToken']) {
    throw new Error('Deprecated header FNS-OpenApi-UserToken should not be used');
  }

  return true;
}

// Константы из документации ФНС
export const FNS_CONSTANTS = {
  ENDPOINTS: {
    AUTH: '/open-api/AuthService/0.1',
    KKT_SERVICE: '/open-api/ais3/KktService/0.1'
  },
  RATE_LIMITS: {
    GET_MESSAGE_PER_SECOND: 1,
    GET_MESSAGE_PER_MINUTE: 12,
    GET_MESSAGES_PER_MINUTE: 5,
    DAILY_REQUEST_LIMIT: 1000
  },
  TIMEOUTS: {
    REQUEST_TIMEOUT: 30000,
    TOKEN_REFRESH_BUFFER: 60000
  }
};