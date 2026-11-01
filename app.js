const { createApp } = Vue;

const generateId = () => Math.random().toString(36).substr(2, 9);

// Use relative URL on any live web hosting / domain (HTTP/HTTPS); fallback to localhost:3000 only when opened as file:///
const API_URL = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
    ? ''
    : 'http://localhost:3000';

createApp({
    data() {
        return {
            dbConnected: false,
            isSaving: false,
            isLoggedIn: false,
            currentUser: null,
            users: [],
            
            loginForm: { username: '', password: '', error: '' },
            accountForm: { username: '', currentPassword: '', newPassword: '', message: '' },

            currentView: 'dashboard',
            
            // Settings
            settings: {
                companyName: 'RUHUNU PRODUCTS',
                logo: '',
                address: '',
                addressLine1: '',
                addressLine2: '',
                phone: '',
                mobileNumber: '',
                whatsappNumber: '',
                email: '',
                footerNote: 'Thank you for your business!',
                termsInfo: 'Please make cheques payable to Ruhunu Products.',
                bankDetails: {
                    bankName: '',
                    accountName: '',
                    accountNumber: '',
                    branchName: '',
                    position: 'left' // 'left', 'center', 'right'
                },
                theme: 'light',
                headerColor: '#16a34a',
                logoSize: 60,
                watermarkImage: '',
                watermarkSize: 50,
                watermarkOpacity: 10,
                logoPosition: 'left',
                companyDetailsAlignment: 'left',
                emptyRowsCount: 4,
                margins: { top: 0, right: 20, bottom: 20, left: 20 },
                invoiceNumberingMode: 'auto',
                autoStartNumber: 1
            },
            
            // State
            products: [],
            customers: [],
            invoices: [],
            history: [],
            
            // UI State
            searchProduct: '',
            searchCustomer: '',
            searchInvoice: '',
            
            modals: {
                product: false,
                customer: false,
                user: false,
                bank: false
            },
            editingItem: null,
            
            formData: {
                product: { code: '', name: '', price: 0 },
                customer: { name: '', phone: '', email: '', address: '' },
                user: { username: '', password: '' }
            },
            
            newInvoice: {
                customerId: '',
                date: new Date().toISOString().substr(0, 10),
                items: [
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 }
                ],
                shippingFee: 0,
                hideBankDetails: false,
                subtotal: 0,
                taxRate: 0,
                total: 0,
                amountPaid: 0,
                balance: 0,
                status: 'Unpaid',
                manualInvoiceNumber: ''
            },
            
            viewingInvoice: null,
            editingInvoiceId: null
        }
    },
    
    computed: {
        viewTitle() {
            const titles = {
                'dashboard': 'Dashboard',
                'products': 'Manage Products',
                'customers': 'Manage Customers',
                'manage_invoices': 'Manage Invoices',
                'create_invoice': '', // Title is custom rendered in the template now
                'manage_template': 'Manage Invoice Template',
                'manage_users': 'Manage System Users',
                'view_invoice': 'Invoice Document',
                'account': 'My Account',
                'history': 'Activity History'
            };
            return titles[this.currentView] || this.currentView;
        },
        filteredProducts() {
            return this.products.filter(p => 
                p.name.toLowerCase().includes(this.searchProduct.toLowerCase()) || 
                p.code.toLowerCase().includes(this.searchProduct.toLowerCase())
            );
        },
        filteredCustomers() {
            return this.customers.filter(c => 
                c.name.toLowerCase().includes(this.searchCustomer.toLowerCase())
            );
        },
        filteredInvoices() {
             return this.invoices.filter(inv => 
                inv.invoiceNumber.toLowerCase().includes(this.searchInvoice.toLowerCase())
            ).sort((a,b) => new Date(b.date) - new Date(a.date));
        },
        recentInvoices() {
            return [...this.invoices].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        },
        totalRevenue() {
            return this.invoices
                .filter(inv => inv.status === 'Paid')
                .reduce((sum, inv) => sum + inv.total, 0);
        },
        isInvoiceValid() {
            const validItems = this.newInvoice.items.filter(i => i.productId || i.description);
            return this.newInvoice.customerId && 
                   validItems.length > 0 && 
                   validItems.every(i => i.qty > 0 && i.price >= 0);
        }
    },
    
    methods: {
        // Authentication
        login() {
            const user = this.users.find(u => u.username === this.loginForm.username && u.password === this.loginForm.password);
            if (user) {
                this.currentUser = user;
                this.isLoggedIn = true;
                localStorage.setItem('rp_session_id', user.id);
                this.loginForm.error = '';
                this.loginForm.password = ''; // clear password from memory
            } else {
                this.loginForm.error = 'Invalid username or password.';
            }
        },
        logout() {
            this.isLoggedIn = false;
            this.currentUser = null;
            localStorage.removeItem('rp_session_id');
            this.currentView = 'dashboard';
        },
        initAccountForm() {
            if (this.currentUser) {
                this.accountForm.username = this.currentUser.username;
                this.accountForm.currentPassword = '';
                this.accountForm.newPassword = '';
                this.accountForm.message = '';
            }
        },
        updateAccount() {
            if (this.accountForm.currentPassword !== this.currentUser.password) {
                this.accountForm.message = 'Current password is incorrect!';
                return;
            }
            
            const idx = this.users.findIndex(u => u.id === this.currentUser.id);
            if (idx !== -1) {
                if (this.accountForm.newPassword) {
                    this.users[idx].password = this.accountForm.newPassword;
                }
                if (this.accountForm.username) {
                    this.users[idx].username = this.accountForm.username;
                }
                this.currentUser = this.users[idx];
                this.saveData();
                this.accountForm.message = 'Account updated successfully!';
                this.accountForm.currentPassword = '';
                this.accountForm.newPassword = '';
            }
        },

        // Init & Save
        loadFromLocalStorage() {
            const storedUsers = localStorage.getItem('rp_users');
            if (storedUsers) {
                let parsedUsers = JSON.parse(storedUsers);
                let migrated = false;
                parsedUsers.forEach(u => {
                    if (!u.role) {
                        u.role = u.username === 'admin' ? 'admin' : 'user';
                        migrated = true;
                    }
                });
                if (!parsedUsers.find(u => u.username === 'user')) {
                    parsedUsers.push({ id: generateId(), username: 'user', password: 'password', role: 'user' });
                    migrated = true;
                }
                this.users = parsedUsers;
            } else {
                this.users = [
                    { id: generateId(), username: 'admin', password: 'password', role: 'admin' },
                    { id: generateId(), username: 'user', password: 'password', role: 'user' }
                ];
            }

            const storedSettings = localStorage.getItem('rp_settings');
            if (storedSettings) {
                const parsedSettings = JSON.parse(storedSettings);
                if (typeof parsedSettings.bankDetails === 'string' || !parsedSettings.bankDetails) {
                    parsedSettings.bankDetails = { bankName: '', accountName: '', accountNumber: '', branchName: '', position: 'left' };
                } else if (!parsedSettings.bankDetails.position) {
                    parsedSettings.bankDetails.position = 'left';
                }
                this.settings = { ...this.settings, ...parsedSettings };
            }
            
            const storedProducts = localStorage.getItem('rp_products');
            if (storedProducts) this.products = JSON.parse(storedProducts);
            
            const storedCustomers = localStorage.getItem('rp_customers');
            if (storedCustomers) this.customers = JSON.parse(storedCustomers);
            
            const storedInvoices = localStorage.getItem('rp_invoices');
            if (storedInvoices) this.invoices = JSON.parse(storedInvoices);
            
            const storedHistory = localStorage.getItem('rp_history');
            if (storedHistory) this.history = JSON.parse(storedHistory);
        },
        saveToLocalStorage() {
            localStorage.setItem('rp_users', JSON.stringify(this.users));
            localStorage.setItem('rp_settings', JSON.stringify(this.settings));
            localStorage.setItem('rp_products', JSON.stringify(this.products));
            localStorage.setItem('rp_customers', JSON.stringify(this.customers));
            localStorage.setItem('rp_invoices', JSON.stringify(this.invoices));
            localStorage.setItem('rp_history', JSON.stringify(this.history));
        },
        async apiRequest(path, options = {}) {
            try {
                const url = `${API_URL}${path}`;
                let res = await fetch(url, options);
                if (res.ok) return res;

                // Fallback for live PHP hosts without rewrite rules
                if ((res.status === 404 || !res.ok) && path.startsWith('/api/')) {
                    const route = path.replace('/api/', '');
                    const fallbackUrl = `${API_URL}/api.php?route=${encodeURIComponent(route)}`;
                    const fallbackRes = await fetch(fallbackUrl, options);
                    if (fallbackRes.ok) return fallbackRes;
                }
                return res;
            } catch (err) {
                if (path.startsWith('/api/')) {
                    const route = path.replace('/api/', '');
                    try {
                        const fallbackUrl = `${API_URL}/api.php?route=${encodeURIComponent(route)}`;
                        return await fetch(fallbackUrl, options);
                    } catch (e) {}
                }
                throw err;
            }
        },
        async loadData() {
            // 1. Initial quick load from local cache
            this.loadFromLocalStorage();

            // 2. Fetch fresh real-time data from database
            try {
                const res = await this.apiRequest('/api/data');
                if (res && res.ok) {
                    const data = await res.json();
                    if (data.users && data.users.length > 0) this.users = data.users;
                    if (data.settings) this.settings = { ...this.settings, ...data.settings };
                    if (data.products) this.products = data.products;
                    if (data.customers) this.customers = data.customers;
                    if (data.invoices) this.invoices = data.invoices;
                    if (data.history) this.history = data.history;
                    this.dbConnected = true;
                    this.saveToLocalStorage();
                } else {
                    this.dbConnected = false;
                }
            } catch (e) {
                this.dbConnected = false;
            }

            // Restore user session if valid
            const sessionId = localStorage.getItem('rp_session_id');
            if (sessionId) {
                const user = this.users.find(u => u.id === sessionId);
                if (user) {
                    this.currentUser = user;
                    this.isLoggedIn = true;
                }
            }
            
            this.applyTheme();
        },
        async saveData() {
            this.saveToLocalStorage();
            this.isSaving = true;
            try {
                const payload = {
                    users: this.users,
                    settings: this.settings,
                    products: this.products,
                    customers: this.customers,
                    invoices: this.invoices,
                    history: this.history
                };
                const res = await this.apiRequest('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res && res.ok) {
                    this.dbConnected = true;
                } else {
                    this.dbConnected = false;
                }
            } catch (err) {
                this.dbConnected = false;
            } finally {
                setTimeout(() => { this.isSaving = false; }, 300);
            }
        },
        logHistory(action, details) {
            this.history.unshift({
                id: generateId(),
                action: action,
                details: details,
                user: this.currentUser ? this.currentUser.username : 'System',
                date: new Date().toISOString()
            });
            if (this.history.length > 500) this.history.pop();
            this.saveData();
        },
        
        // Theme
        toggleTheme() {
            this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
            this.applyTheme();
            this.saveData();
        },
        applyTheme() {
            if (this.settings.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },
        
        // Sidebar Navigation Styles
        navItemClass(view) {
            return this.currentView === view ? 'nav-item nav-item-active' : 'nav-item';
        },
        navIconClass(view) {
            return 'nav-icon';
        },
        
        // Formatting
        formatCurrency(value) {
            return Number(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },
        formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString();
        },
        
        // Modals
        openBankModal() {
            this.modals.bank = true;
        },
        closeModals() {
            this.modals.product = false;
            this.modals.customer = false;
            this.modals.user = false;
            this.modals.bank = false;
            this.editingItem = null;
        },

        // Users
        openUserModal(user = null) {
            this.editingItem = user ? user.id : null;
            if (user) {
                this.formData.user = { username: user.username, password: user.password, role: user.role || 'user' };
            } else {
                this.formData.user = { username: '', password: '', role: 'user' };
            }
            this.modals.user = true;
        },
        saveUser() {
            if (!this.formData.user.username || !this.formData.user.password) return;
            
            if (this.editingItem) {
                const idx = this.users.findIndex(u => u.id === this.editingItem);
                if (idx !== -1) {
                    this.users[idx] = { ...this.formData.user, id: this.editingItem };
                    this.logHistory('Edit User', `Updated user: ${this.formData.user.username}`);
                }
            } else {
                this.users.push({ ...this.formData.user, id: generateId() });
                this.logHistory('Add User', `Added new user: ${this.formData.user.username}`);
            }
            this.saveData();
            this.closeModals();
        },
        deleteUser(id) {
            if (this.currentUser.id === id) {
                alert("You cannot delete your own account.");
                return;
            }
            if (confirm('Are you sure you want to delete this user?')) {
                const user = this.users.find(u => u.id === id);
                if (user) this.logHistory('Delete User', `Deleted user: ${user.username}`);
                this.users = this.users.filter(u => u.id !== id);
                this.saveData();
            }
        },
        
        // Products
        openProductModal(product = null) {
            this.editingItem = product ? product.id : null;
            if (product) {
                this.formData.product = { ...product };
            } else {
                this.formData.product = { code: '', name: '', price: 0 };
            }
            this.modals.product = true;
        },
        saveProduct() {
            if (!this.formData.product.name) return;
            
            if (this.editingItem) {
                const idx = this.products.findIndex(p => p.id === this.editingItem);
                if (idx !== -1) {
                    this.products[idx] = { ...this.formData.product, id: this.editingItem };
                    this.logHistory('Edit Product', `Updated product: ${this.formData.product.name}`);
                }
            } else {
                this.products.push({ ...this.formData.product, id: generateId() });
                this.logHistory('Add Product', `Added new product: ${this.formData.product.name}`);
            }
            this.saveData();
            this.closeModals();
        },
        deleteProduct(id) {
            if (confirm('Are you sure you want to delete this product?')) {
                const prod = this.products.find(p => p.id === id);
                if (prod) this.logHistory('Delete Product', `Deleted product: ${prod.name}`);
                this.products = this.products.filter(p => p.id !== id);
                this.saveData();
            }
        },
        getProductName(id) {
            const p = this.products.find(p => p.id === id);
            return p ? p.name : 'Unknown Product';
        },
        
        // Customers
        openCustomerModal(customer = null) {
            this.editingItem = customer ? customer.id : null;
            if (customer) {
                this.formData.customer = { ...customer };
            } else {
                this.formData.customer = { name: '', phone: '', addressLine1: '', addressLine2: '' };
            }
            this.modals.customer = true;
        },
        saveCustomer() {
            if (!this.formData.customer.name) return;
            
            if (this.editingItem) {
                const idx = this.customers.findIndex(c => c.id === this.editingItem);
                if (idx !== -1) {
                    this.customers[idx] = { ...this.formData.customer, id: this.editingItem };
                    this.logHistory('Edit Customer', `Updated customer: ${this.formData.customer.name}`);
                }
            } else {
                this.customers.push({ ...this.formData.customer, id: generateId() });
                this.logHistory('Add Customer', `Added new customer: ${this.formData.customer.name}`);
            }
            this.saveData();
            this.closeModals();
        },
        deleteCustomer(id) {
            if (confirm('Are you sure you want to delete this customer?')) {
                const cust = this.customers.find(c => c.id === id);
                if (cust) this.logHistory('Delete Customer', `Deleted customer: ${cust.name}`);
                this.customers = this.customers.filter(c => c.id !== id);
                this.saveData();
            }
        },
        getCustomer(id) {
            return this.customers.find(c => c.id === id) || null;
        },
        getCustomerName(id) {
            const c = this.getCustomer(id);
            return c ? c.name : 'Unknown Customer';
        },
        
        // Invoices
        addInvoiceItem() {
            this.newInvoice.items.push({ productId: '', description: '', qty: 1, price: 0 });
        },
        removeInvoiceItem(index) {
            this.newInvoice.items.splice(index, 1);
            this.calculateTotals();
        },
        updateItemPrice(index) {
            const item = this.newInvoice.items[index];
            const product = this.products.find(p => p.id === item.productId);
            if (product) {
                item.price = product.price;
                item.description = product.name; // Set description to product name initially
            } else {
                item.price = 0;
            }
            this.calculateTotals();
        },
        calculateTotals() {
            const subtotal = this.newInvoice.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            this.newInvoice.subtotal = subtotal;
            const tax = (subtotal * this.newInvoice.taxRate) / 100;
            const shipping = Number(this.newInvoice.shippingFee) || 0;
            this.newInvoice.total = subtotal + tax + shipping;
            const paid = Number(this.newInvoice.amountPaid) || 0;
            this.newInvoice.balance = this.newInvoice.total - paid;
            
            if (this.newInvoice.balance <= 0 && this.newInvoice.total > 0) {
                this.newInvoice.status = 'Paid';
            } else if (paid > 0 && this.newInvoice.balance > 0) {
                this.newInvoice.status = 'Partial';
            } else {
                this.newInvoice.status = 'Unpaid';
            }
        },
        editInvoice(invoice) {
            // Load invoice data into the form
            this.editingInvoiceId = invoice.id;
            this.newInvoice = JSON.parse(JSON.stringify(invoice));
            // Ensure all item fields exist for older invoices
            this.newInvoice.items = this.newInvoice.items.map(item => ({
                productId: item.productId || '',
                description: item.description || '',
                qty: item.qty || 1,
                price: item.price || 0
            }));
            this.currentView = 'create_invoice';
        },
        cancelInvoiceEdit() {
            this.editingInvoiceId = null;
            this.newInvoice = {
                customerId: '',
                date: new Date().toISOString().substr(0, 10),
                items: [
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 }
                ],
                shippingFee: 0,
                hideBankDetails: false,
                subtotal: 0,
                taxRate: 0,
                total: 0,
                amountPaid: 0,
                balance: 0,
                status: 'Unpaid',
                manualInvoiceNumber: ''
            };
            this.currentView = 'manage_invoices';
        },
        generateInvoiceNumber() {
            if (this.settings.invoiceNumberingMode === 'manual') {
                return this.newInvoice.manualInvoiceNumber || 'MANUAL-001';
            }
            const year = new Date().getFullYear();
            const num = Number(this.settings.autoStartNumber) + this.invoices.length;
            return `INV-${year}-${num.toString().padStart(4, '0')}`;
        },
        saveInvoice() {
            // Filter out empty rows automatically
            this.newInvoice.items = this.newInvoice.items.filter(i => i.productId || i.description);
            
            if (!this.isInvoiceValid) return;
            if (this.settings.invoiceNumberingMode === 'manual' && !this.newInvoice.manualInvoiceNumber.trim()) {
                alert('Please enter an invoice number.');
                return;
            }

            if (this.editingInvoiceId) {
                // UPDATE existing invoice
                const idx = this.invoices.findIndex(i => i.id === this.editingInvoiceId);
                if (idx !== -1) {
                    this.invoices[idx] = {
                        ...JSON.parse(JSON.stringify(this.newInvoice)),
                        id: this.editingInvoiceId,
                        // Keep original invoice number unless manual mode changed it
                        invoiceNumber: this.invoices[idx].invoiceNumber
                    };
                }
                this.logHistory('Edit Invoice', `Updated invoice: ${this.invoices[idx]?.invoiceNumber}`);
                this.saveData();
                const updated = this.invoices.find(i => i.id === this.editingInvoiceId);
                this.editingInvoiceId = null;
                // Reset form
                this.newInvoice = {
                    customerId: '',
                    date: new Date().toISOString().substr(0, 10),
                    items: [
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 }
                ],
                    shippingFee: 0,
                    hideBankDetails: false,
                    subtotal: 0,
                    taxRate: 0,
                    total: 0,
                amountPaid: 0,
                balance: 0,
                    status: 'Unpaid',
                    manualInvoiceNumber: ''
                };
                this.viewInvoice(updated);
            } else {
                // CREATE new invoice
                const invoice = {
                    ...JSON.parse(JSON.stringify(this.newInvoice)),
                    id: generateId(),
                    invoiceNumber: this.generateInvoiceNumber(),
                };
                this.invoices.push(invoice);
                this.logHistory('Create Invoice', `Created new invoice: ${invoice.invoiceNumber}`);
                this.saveData();
                // Reset form
                this.newInvoice = {
                    customerId: '',
                    date: new Date().toISOString().substr(0, 10),
                    items: [
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 },
                    { productId: '', description: '', qty: 1, price: 0 }
                ],
                    shippingFee: 0,
                    hideBankDetails: false,
                    subtotal: 0,
                    taxRate: 0,
                    total: 0,
                amountPaid: 0,
                balance: 0,
                    status: 'Unpaid',
                    manualInvoiceNumber: ''
                };
                this.viewInvoice(invoice);
            }
        },
        deleteInvoice(id) {
            if (confirm('Are you sure you want to delete this invoice?')) {
                const inv = this.invoices.find(i => i.id === id);
                if (inv) this.logHistory('Delete Invoice', `Deleted invoice: ${inv.invoiceNumber}`);
                this.invoices = this.invoices.filter(i => i.id !== id);
                this.saveData();
            }
        },
        viewInvoice(invoice) {
            this.viewingInvoice = {
                ...invoice,
                amountPaid: invoice.amountPaid || 0,
                balance: invoice.balance !== undefined ? invoice.balance : invoice.total
            };
            this.currentView = 'view_invoice';
        },
        printInvoice() {
            window.print();
        }
    },
    
    mounted() {
        this.loadData();
    }
}).mount('#app');
