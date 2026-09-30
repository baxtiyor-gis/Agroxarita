from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('soil', '0003_agrokimyo_alohida'),
    ]

    operations = [
        migrations.RenameModel(old_name='TuproqLugat', new_name='TuproqClass'),
        migrations.RemoveConstraint(model_name='tuproqclass', name='tuproqlugat_tur_kod_uniq'),
        migrations.AddConstraint(
            model_name='tuproqclass',
            constraint=models.UniqueConstraint(fields=('tur', 'kod'), name='tuproqclass_tur_kod_uniq'),
        ),
        migrations.AlterModelOptions(
            name='tuproqclass',
            options={'ordering': ['tur', 'kod'], 'verbose_name_plural': "tuproq classlari"},
        ),
    ]
