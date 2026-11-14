// Utility for Web Bluetooth Printer & Receipt Formatting

let bluetoothDevice = null;
let bluetoothCharacteristic = null;

// Re-map the device on reload if possible
export async function autoReconnect() {
  if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return;
  
  try {
    const devices = await navigator.bluetooth.getDevices();
    const lastId = localStorage.getItem('lastPrinterId');
    const device = devices.find(d => d.id === lastId);
    
    if (device) {
      console.log('Found remembered printer, attempting quick-connect...');
      return await performConnection(device);
    }
  } catch (e) { console.error('Auto-reconnect failed', e); }
}

async function performConnection(device) {
  try {
     console.log('Connecting to GATT Server...');
     const server = await device.gatt.connect();
     console.log('✅ GATT Server Connected!');
     
     await new Promise(resolve => setTimeout(resolve, 2000));
     
     const services = await server.getPrimaryServices();
     let foundChar = null;
     for (const service of services) {
       try {
         const chars = await service.getCharacteristics();
         for (const char of chars) {
           if (char.properties.write || char.properties.writeWithoutResponse) {
             foundChar = char;
             break;
           }
         }
       } catch {
         // Service characteristics unreadable or unsupported
       }
       if (foundChar) break;
     }

     if (foundChar) {
       bluetoothDevice = device;
       bluetoothCharacteristic = foundChar;
       localStorage.setItem('lastPrinterId', device.id);
       device.addEventListener('gattserverdisconnected', () => {
         bluetoothDevice = null;
         bluetoothCharacteristic = null;
       });
       return true;
     }
  } catch (e) { console.error(e); }
  return false;
}

export async function connectPrinter() {
  if (!navigator.bluetooth) {
    alert('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
    return;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', 
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000ae00-0000-1000-8000-00805f9b34fb'
      ]
    });

    const success = await performConnection(device);
    if (success) {
      alert(`SUCCESS: Connected to ${device.name}! Ready to print.`);
    } else {
      alert('Could not find printing service on this device.');
    }
  } catch (error) {
    console.error('Final Bluetooth Attempt Error:', error);
    alert('Still disconnected: ' + error.message);
  }
}

export async function sendToPrinter(content) {
  try {
    if (!bluetoothCharacteristic) {
      console.log('No printer connected, falling back to window print.');
      // We don't alert here because we want to silently fallback to native print if user never connected
      return false;
    }
    
    console.log('Sending data to Bluetooth printer...');
    // ESC/POS init command and trailing newlines
    const initCmd = '\x1B\x40';
    const fullContent = initCmd + content + '\n\n\n\n';
    
    const encoder = new TextEncoder();
    const data = encoder.encode(fullContent);
    
    // Chunk the data to avoid MTU size limits
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (bluetoothCharacteristic.properties.writeWithoutResponse) {
        await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await bluetoothCharacteristic.writeValue(chunk);
      }
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    console.log('Bluetooth print complete!');
    return true;
  } catch (error) {
    console.error('Bluetooth print failed:', error);
    alert('Bluetooth Error: ' + error.message + ' | Falling back to window print.');
    return false;
  }
}

export function generateBillContent(invoiceNumber, items, subtotal, paymentMode, business = {}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN');
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // 58mm Thermal Printers hold exactly 32 standard characters per line.
  const LINE_WIDTH = 32;

  let bill = `\n`;
  
  // Header: Business Details
  if (business.business_name) {
    bill += `${business.business_name.toUpperCase().substring(0, LINE_WIDTH)}\n`;
  } else {
    bill += `SIMPLEBILL PRO\n`;
  }
  
  if (business.location) bill += `${business.location.substring(0, LINE_WIDTH)}\n`;
  if (business.phone) bill += `Tel: ${business.phone}\n`;
  if (business.gst_number) bill += `GST: ${business.gst_number}\n`;

  bill += `${'='.repeat(LINE_WIDTH)}
INVOICE
Date: ${dateStr} ${timeStr}
Inv: #${invoiceNumber}
${'='.repeat(LINE_WIDTH)}

${'-'.repeat(LINE_WIDTH)}
Item         Qty  Price    Total
${'-'.repeat(LINE_WIDTH)}
`;

  // Layout: Item(12) Qty(3) Price(6) Total(8) = 12+1+3+1+6+1+8 = 32
  items.forEach(item => {
      const itemTotal = item.price * item.qty;
      const nameStr = item.name.substring(0, 12).padEnd(12);
      const qtyStr = item.qty.toString().padStart(3);
      const priceStr = item.price.toFixed(2).padStart(6);
      const totalStr = itemTotal.toFixed(2).padStart(8);
      
      bill += `${nameStr} ${qtyStr} ${priceStr} ${totalStr}\n`;
  });

  bill += `${'-'.repeat(LINE_WIDTH)}\n`;
  bill += `Subtotal: ${subtotal.toFixed(2).padStart(LINE_WIDTH - 10)}\n`;
  bill += `${'='.repeat(LINE_WIDTH)}\n`;
  bill += `TOTAL: Rs ${subtotal.toFixed(2).padStart(LINE_WIDTH - 10)}\n`;
  bill += `\nItems: ${items.length.toString().padEnd(3)} Paid via: ${paymentMode}\n`;
  bill += `${'-'.repeat(LINE_WIDTH)}\n`;
  
  if (business.custom_message) {
    // Basic word wrap for custom message
    const msg = business.custom_message;
    for (let i = 0; i < msg.length; i += LINE_WIDTH) {
      bill += msg.substring(i, i + LINE_WIDTH) + '\n';
    }
    bill += `${'-'.repeat(LINE_WIDTH)}\n`;
  }

  bill += `Thank You!\n`;
  bill += `${'='.repeat(LINE_WIDTH)}\n`;

  return bill;
}

export function fallbackNativePrint(content, logoUrl = '') {
  const effectiveLogo = logoUrl || localStorage.getItem('receiptLogo') || '';
  const hideFrame = document.createElement('iframe');
  hideFrame.style.position = 'fixed';
  hideFrame.style.right = '0';
  hideFrame.style.bottom = '0';
  hideFrame.style.width = '0';
  hideFrame.style.height = '0';
  hideFrame.style.border = '0';
  document.body.appendChild(hideFrame);

  const doc = hideFrame.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt Slip</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
            font-size: 13px;
            white-space: pre-wrap;
            margin: 0;
            padding: 12px 14px;
            color: #000000;
            background: #ffffff;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-logo {
            display: block;
            max-height: 54px;
            max-width: 170px;
            margin: 0 auto 10px auto;
            object-fit: contain;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        </style>
      </head>
      <body>
        ${effectiveLogo ? `<img src="${effectiveLogo}" alt="Logo" class="receipt-logo" id="native-slip-logo" />` : ''}
        ${content}
      </body>
    </html>
  `);
  doc.close();

  const triggerPrint = () => {
    try {
      hideFrame.contentWindow.focus();
      hideFrame.contentWindow.print();
    } catch (e) {
      console.error('Print trigger error', e);
    } finally {
      setTimeout(() => {
        if (hideFrame.parentNode) {
          document.body.removeChild(hideFrame);
        }
      }, 1500);
    }
  };

  const img = doc.getElementById('native-slip-logo');
  if (img && !img.complete) {
    img.onload = triggerPrint;
    img.onerror = triggerPrint;
    setTimeout(triggerPrint, 500);
  } else {
    setTimeout(triggerPrint, 150);
  }
}

export function printFormattedReceipt(options = {}) {
  const {
    invoiceNumber = '0000',
    items = [],
    total = 0,
    paymentMode = 'cash',
    business = {},
    subtotal = total,
    discount = 0,
    date = new Date(),
    logoUrl = ''
  } = options;

  const gid = localStorage.getItem('selectedGroupId');
  const effectiveLogo =
    logoUrl ||
    business?.logo_url ||
    (gid ? localStorage.getItem(`receiptLogo_${gid}`) : null) ||
    localStorage.getItem('receiptLogo') ||
    '';

  const hideFrame = document.createElement('iframe');
  hideFrame.style.position = 'fixed';
  hideFrame.style.right = '0';
  hideFrame.style.bottom = '0';
  hideFrame.style.width = '0';
  hideFrame.style.height = '0';
  hideFrame.style.border = '0';
  document.body.appendChild(hideFrame);

  const formattedDate = new Date(date).toLocaleDateString('en-IN');
  const formattedTime = new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt #${invoiceNumber}</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
            font-size: 12px;
            color: #000000;
            background: #ffffff;
            margin: 0;
            padding: 12px 14px;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-logo {
            max-height: 52px;
            max-width: 170px;
            height: auto;
            display: block;
            margin: 0 auto 8px auto;
            object-fit: contain;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-header {
            text-align: center;
            margin-bottom: 10px;
          }
          .business-title {
            font-size: 15px;
            font-weight: 800;
            margin: 0 0 3px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .business-info {
            font-size: 11px;
            color: #333333;
            line-height: 1.35;
          }
          .receipt-divider {
            border-top: 1px dashed #000000;
            margin: 8px 0;
          }
          .receipt-meta {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 8px;
          }
          th {
            border-top: 1px dashed #000000;
            border-bottom: 1px dashed #000000;
            padding: 5px 0;
            text-align: left;
            font-size: 10.5px;
            text-transform: uppercase;
          }
          td {
            padding: 4px 0;
            vertical-align: top;
          }
          .col-item { text-align: left; }
          .col-qty { text-align: center; }
          .col-amt { text-align: right; }
          .receipt-totals {
            font-size: 11px;
            margin-top: 4px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
          }
          .grand-total {
            font-size: 14px;
            font-weight: 800;
            border-top: 1px solid #000000;
            border-bottom: 1px solid #000000;
            padding: 6px 0;
            margin: 6px 0;
          }
          .receipt-footer {
            text-align: center;
            margin-top: 12px;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          ${effectiveLogo ? `<img src="${effectiveLogo}" alt="Logo" class="receipt-logo" id="formatted-slip-logo" />` : ''}
          <div class="business-title">${business?.business_name || 'SIMPLEBILL PRO'}</div>
          ${business?.location ? `<div class="business-info">${business.location}</div>` : ''}
          ${business?.phone ? `<div class="business-info">Tel: ${business.phone}</div>` : ''}
          ${business?.gst_number ? `<div class="business-info">GST: ${business.gst_number}</div>` : ''}
        </div>

        <div class="receipt-divider"></div>

        <div class="receipt-meta">
          <div>
            <div><strong>Inv:</strong> #${invoiceNumber}</div>
            <div><strong>Date:</strong> ${formattedDate}</div>
          </div>
          <div style="text-align: right;">
            <div><strong>Mode:</strong> ${paymentMode.toUpperCase()}</div>
            <div><strong>Time:</strong> ${formattedTime}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="col-item">Item</th>
              <th class="col-qty">Qty</th>
              <th class="col-amt">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td class="col-item">${i.name}</td>
                <td class="col-qty">${i.qty}</td>
                <td class="col-amt">Rs ${(i.price * i.qty).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="receipt-divider"></div>

        <div class="receipt-totals">
          ${subtotal ? `
            <div class="total-row">
              <span>Subtotal:</span>
              <span>Rs ${Number(subtotal).toFixed(2)}</span>
            </div>
          ` : ''}
          ${discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-Rs ${Number(discount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>Rs ${Number(total).toFixed(2)}</span>
          </div>
        </div>

        <div class="receipt-footer">
          ${business?.custom_message ? `<div>${business.custom_message}</div>` : ''}
          <div style="font-weight: 700; margin-top: 4px;">Thank You! Visit Again</div>
        </div>
      </body>
    </html>
  `;

  const doc = hideFrame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      hideFrame.contentWindow.focus();
      hideFrame.contentWindow.print();
    } catch (e) {
      console.error('Print trigger error', e);
    } finally {
      setTimeout(() => {
        if (hideFrame.parentNode) {
          document.body.removeChild(hideFrame);
        }
      }, 1500);
    }
  };

  const img = doc.getElementById('formatted-slip-logo');
  if (img && !img.complete) {
    img.onload = triggerPrint;
    img.onerror = triggerPrint;
    setTimeout(triggerPrint, 500);
  } else {
    setTimeout(triggerPrint, 150);
  }
}

export function isPrinterConnected() {
  return !!bluetoothCharacteristic;
}

export function getConnectedDevice() {
  return bluetoothDevice;
}

export function getNextTokenNumber(groupId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateKey = `token_date_${groupId || 'default'}`;
  const numKey = `token_seq_${groupId || 'default'}`;

  const lastDate = localStorage.getItem(dateKey);
  let seq = parseInt(localStorage.getItem(numKey) || '0', 10);

  if (lastDate !== todayStr) {
    seq = 1;
  } else {
    seq += 1;
  }

  localStorage.setItem(dateKey, todayStr);
  localStorage.setItem(numKey, String(seq));
  return String(seq).padStart(2, '0');
}

export function generateTokenContent(tokenNumber, invoiceNumber, items = [], orderType = 'Counter Pickup', business = {}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN');
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const LINE_WIDTH = 32;

  let token = `\n`;
  token += `${'='.repeat(LINE_WIDTH)}\n`;
  token += `   ${(business.business_name || 'FOOD COUNTER').toUpperCase().substring(0, 26)}\n`;
  token += `        ORDER TOKEN\n`;
  token += `${'='.repeat(LINE_WIDTH)}\n\n`;
  token += `        TOKEN #${tokenNumber}\n\n`;
  token += `${'='.repeat(LINE_WIDTH)}\n`;
  token += `Inv: #${invoiceNumber}\n`;
  token += `Type: ${orderType.toUpperCase()}\n`;
  token += `Time: ${dateStr} ${timeStr}\n`;
  token += `${'-'.repeat(LINE_WIDTH)}\n`;
  token += `QTY   ITEM DESCRIPTION\n`;
  token += `${'-'.repeat(LINE_WIDTH)}\n`;

  let totalQty = 0;
  items.forEach(item => {
    totalQty += item.qty;
    const qtyStr = `${item.qty}x`.padEnd(5);
    const nameStr = item.name.substring(0, 24);
    token += `[ ] ${qtyStr} ${nameStr}\n`;
  });

  token += `${'-'.repeat(LINE_WIDTH)}\n`;
  token += `Total Items: ${items.length}  Total Qty: ${totalQty}\n`;
  token += `${'='.repeat(LINE_WIDTH)}\n`;
  token += `Please present this token at counter\n`;
  token += `      for food collection\n`;
  token += `${'='.repeat(LINE_WIDTH)}\n\n\n\n`;

  return token;
}

export function printOrderToken(options = {}) {
  const {
    tokenNumber = '01',
    invoiceNumber = '0000',
    items = [],
    orderType = 'Counter Pickup',
    business = {},
    date = new Date()
  } = options;

  const hideFrame = document.createElement('iframe');
  hideFrame.style.position = 'fixed';
  hideFrame.style.right = '0';
  hideFrame.style.bottom = '0';
  hideFrame.style.width = '0';
  hideFrame.style.height = '0';
  hideFrame.style.border = '0';
  document.body.appendChild(hideFrame);

  const formattedDate = new Date(date).toLocaleDateString('en-IN');
  const formattedTime = new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const totalQty = items.reduce((sum, i) => sum + (Number(i.qty) || 1), 0);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Token #${tokenNumber}</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
            font-size: 13px;
            color: #000000;
            background: #ffffff;
            margin: 0;
            padding: 14px 16px;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .token-header {
            text-align: center;
            border-bottom: 2px dashed #000000;
            padding-bottom: 12px;
            margin-bottom: 12px;
          }
          .store-name {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .token-badge-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #555555;
          }
          .token-number-hero {
            font-size: 44px;
            font-weight: 900;
            line-height: 1;
            margin: 10px 0;
            letter-spacing: -1px;
          }
          .token-type-pill {
            display: inline-block;
            font-size: 11px;
            font-weight: 800;
            border: 1.5px solid #000000;
            padding: 2px 10px;
            border-radius: 4px;
            text-transform: uppercase;
            margin-top: 4px;
          }
          .token-meta {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 10px;
            border-bottom: 1px dashed #000000;
            padding-bottom: 8px;
          }
          .items-header {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            border-bottom: 1px solid #000000;
            padding-bottom: 4px;
            margin-bottom: 8px;
          }
          .item-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 6px 0;
            border-bottom: 1px dotted #cccccc;
            font-size: 13px;
          }
          .item-box {
            width: 14px;
            height: 14px;
            border: 1.5px solid #000000;
            border-radius: 2px;
            margin-top: 2px;
            flex-shrink: 0;
          }
          .item-qty {
            font-weight: 800;
            font-size: 14px;
            min-width: 28px;
          }
          .item-name {
            font-weight: 700;
            flex: 1;
          }
          .token-summary {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 800;
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #000000;
          }
          .token-footer {
            text-align: center;
            margin-top: 14px;
            padding-top: 10px;
            border-top: 2px dashed #000000;
            font-size: 11px;
            font-weight: 600;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="token-header">
          <div class="store-name">${business?.business_name || 'FOOD COUNTER TOKEN'}</div>
          <div class="token-badge-title">Kitchen / Counter Order</div>
          <div class="token-number-hero">#${tokenNumber}</div>
          <div class="token-type-pill">${orderType}</div>
        </div>

        <div class="token-meta">
          <div>
            <div><strong>Inv:</strong> #${invoiceNumber}</div>
            <div><strong>Date:</strong> ${formattedDate}</div>
          </div>
          <div style="text-align: right;">
            <div><strong>Time:</strong> ${formattedTime}</div>
            <div><strong>Items:</strong> ${items.length} (${totalQty} pcs)</div>
          </div>
        </div>

        <div class="items-header">
          <span>Items to Prepare / Handover</span>
          <span>Qty</span>
        </div>

        <div>
          ${items.map(i => `
            <div class="item-row">
              <div class="item-box"></div>
              <div class="item-qty">${i.qty}x</div>
              <div class="item-name">${i.name}</div>
            </div>
          `).join('')}
        </div>

        <div class="token-summary">
          <span>Total Quantities</span>
          <span>${totalQty} items</span>
        </div>

        <div class="token-footer">
          <div>Please show this token at the counter</div>
          <div>for food order collection &bull; Thank You!</div>
        </div>
      </body>
    </html>
  `;

  const doc = hideFrame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      hideFrame.contentWindow.focus();
      hideFrame.contentWindow.print();
    } catch (e) {
      console.error('Print token error', e);
    } finally {
      setTimeout(() => {
        if (hideFrame.parentNode) {
          document.body.removeChild(hideFrame);
        }
      }, 1500);
    }
  }, 150);
}

export function printBothReceiptAndToken(receiptOptions = {}, tokenOptions = {}) {
  printFormattedReceipt(receiptOptions);
  setTimeout(() => {
    printOrderToken(tokenOptions);
  }, 1200);
}
