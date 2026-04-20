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
       } catch (e) {}
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

export function fallbackNativePrint(content) {
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
  doc.write('<html><head><style>body { font-family: monospace; font-size: 14px; white-space: pre-wrap; margin: 0; padding: 10px; color: black; }</style></head><body>');
  doc.write(content);
  doc.write('</body></html>');
  doc.close();

  hideFrame.contentWindow.focus();
  hideFrame.contentWindow.print();

  setTimeout(() => {
      document.body.removeChild(hideFrame);
  }, 1000);
}

export function isPrinterConnected() {
  return !!bluetoothCharacteristic;
}
