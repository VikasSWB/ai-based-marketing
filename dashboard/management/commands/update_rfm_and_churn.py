from django.core.management.base import BaseCommand
from dashboard import ml_data_preparation, ml_model_building

class Command(BaseCommand):
    help = 'Updates RFM features and retrains the churn prediction model'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting RFM and churn model update...'))

        try:
            # Run the data preparation script
            self.stdout.write('Running data preparation...')
            ml_data_preparation.main()
            self.stdout.write(self.style.SUCCESS('Data preparation completed successfully.'))

            # Run the model building script
            self.stdout.write('Running model building...')
            ml_model_building.main()
            self.stdout.write(self.style.SUCCESS('Model building completed successfully.'))

            self.stdout.write(self.style.SUCCESS('RFM and churn model update completed successfully.'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error during update: {str(e)}'))
            raise