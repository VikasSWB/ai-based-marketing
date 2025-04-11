
### TESTING ####

from django.db import models
## NEW ##
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.management import call_command

class Order(models.Model):
    order_id = models.AutoField(primary_key=True)
    order_number = models.CharField(max_length=50, unique=True)
    order_date = models.DateTimeField()
    order_status = models.CharField(max_length=50)
    coupon_code = models.CharField(max_length=50, null=True, blank=True)
    order_total = models.DecimalField(max_digits=10, decimal_places=2)
    order_discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    order_refunded = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    order_tax = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shipping_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    customer_name = models.CharField(max_length=100)
    customer_email = models.EmailField()
    payment_method = models.CharField(max_length=50)
    # Fields that were previously in OrderItem, now assumed to be in the orders table
    product_name = models.CharField(max_length=100)
    product_sku = models.CharField(max_length=50)
    product_unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    product_quantity = models.IntegerField()
    product_discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    product_tax = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    product_row_total = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"Order {self.order_number}"

    class Meta:
        db_table = 'orders'  # Changed from 'order' to 'orders'

# Signal to update RFM and churn model when a new order is added
@receiver(post_save, sender=Order)
def update_rfm_and_churn_on_new_order(sender, instance, created, **kwargs):
    if created:  # Only trigger on new orders (not updates)
        try:
            print(f"New order detected: {instance.order_id}. Updating RFM and churn model...")
            call_command('update_rfm_and_churn')
            print("RFM and churn model updated successfully.")
        except Exception as e:
            print(f"Error updating RFM and churn model: {str(e)}")