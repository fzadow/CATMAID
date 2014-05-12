import json
from datetime import timedelta, datetime
from dateutil import parser as dateparser

from django.http import HttpResponse
from django.db.models import Count
from django.db import connection

from catmaid.control.authentication import requires_user_role
from catmaid.models import ClassInstance, Connector, Treenode, User, UserRole, Review


def _process(query, minus1name):
    cursor = connection.cursor()
    cursor.execute(query)

    # Get name dictonary separatly to avaoid joining the user table to the
    # treenode table, which in turn improves performance.
    names = dict(User.objects.values_list('id', 'username'))

    result = {'users': [],
              'values': []}
    for row in cursor.fetchall():
        result['values'].append(row[1])
        s = (names[row[0]], row[1]) if -1 != row[0] else (minus1name, row[1])
        result['users'].append('%s (%d)' % s)
    return HttpResponse(json.dumps(result), mimetype='text/json')


@requires_user_role([UserRole.Annotate, UserRole.Browse])
def stats_nodecount(request, project_id=None):
    return _process('''
    SELECT user_id, count(user_id)
    FROM treenode
    WHERE project_id=%s
    GROUP BY user_id
    ''' % int(project_id), "*anonymous*")


@requires_user_role([UserRole.Annotate, UserRole.Browse])
def stats_editor(request, project_id=None):
    return _process('''
    SELECT editor_id, count(editor_id)
    FROM treenode
    WHERE project_id=%s
      AND editor_id != user_id
    GROUP BY username
    ''' % int(project_id), "*unedited*")


@requires_user_role([UserRole.Annotate, UserRole.Browse])
def stats_summary(request, project_id=None):
    startdate = datetime.today()
    result = {
        'treenodes_created': Treenode.objects.filter(
            project=project_id,
            user=request.user.id,
            creation_time__year=startdate.year,
            creation_time__month=startdate.month,
            creation_time__day=startdate.day).count(),
        'connectors_created': Connector.objects.filter(
            project=project_id,
            user=request.user.id,
            creation_time__year=startdate.year,
            creation_time__month=startdate.month,
            creation_time__day=startdate.day
            ).count(),
    }
    for key, class_name in [
            ('skeletons_created', 'skeleton')
            ]:
        result[key] = ClassInstance.objects.filter(
            project=project_id,
            user=request.user.id,
            creation_time__year=startdate.year,
            creation_time__month=startdate.month,
            creation_time__day=startdate.day,
            class_column__class_name=class_name).count()
    return HttpResponse(json.dumps(result), mimetype='text/json')


@requires_user_role([UserRole.Annotate, UserRole.Browse])
def stats_history(request, project_id=None):
    # Get the start and end dates for the query, defaulting to the last 30
    # days.
    start_date = request.GET.get('start_date', datetime.now() - timedelta(30))
    end_date = request.GET.get('end_date', datetime.now())

    # Look up all tree nodes for the project in the given date range.
    # Also add a computed field which is just the day of the last edited
    # date/time.
    tree_nodes = Treenode.objects \
        .filter(
            project=project_id,
            edition_time__range=(start_date, end_date)) \
        .extra(select={
            'date': 'to_char("treenode"."edition_time", \'YYYYMMDD\')'}) \
        .order_by('user', 'date')

    # Get the count of tree nodes for each user/day combination.
    stats = tree_nodes.values('user__username', 'date') \
        .annotate(count=Count('id'))

    # Change the 'user__username' field name to just 'name'.
    # (If <https://code.djangoproject.com/ticket/12222> ever gets implemented
    # then this wouldn't be necessary.)
    stats = [{
        'name': stat['user__username'],
        'date': stat['date'],
        'count': stat['count']} for stat in stats]

    return HttpResponse(json.dumps(stats), mimetype='text/json')


def stats_user_history(request, project_id=None):
    # Get the start date for the query, defaulting to 10 days ago.
    start_date = request.GET.get('start_date', None)
    if start_date:
        start_date = dateparser.parse(start_date)
        print(start_date)
    else:
        start_date = datetime.now() - timedelta(10)
    # Get the end date for the query, defaulting to now.
    end_date = request.GET.get('end_date', None)
    if end_date:
        # We need to set the end date to the last second of the day to get all
        # events.
        end_date = dateparser.parse(end_date) + timedelta(days=1) - timedelta(seconds=1)
    else:
        end_date = datetime.now()
    # Calculate number of days between (including) start and end
    daydelta = (end_date + timedelta(days=1) - start_date).days

    all_users = User.objects.filter().values('username', 'id')
    map_userid_to_name = {}
    for user in all_users:
        map_userid_to_name[user['id']] = user['username']
    days = []
    daysformatted = []
    for i in range(daydelta):
        tmp_date = start_date + timedelta(days=i)
        days.append(tmp_date.strftime("%Y%m%d"))
        daysformatted.append(tmp_date.strftime("%a %d, %h %Y"))
    stats_table = {}
    for userid in map_userid_to_name.keys():
        if userid == -1:
            continue
        stats_table[map_userid_to_name[userid]] = {}
        for i in range(daydelta):
            name = map_userid_to_name[userid]
            date = (start_date + timedelta(days=i)).strftime("%Y%m%d")
            stats_table[name][date] = {}

    # Look up all tree nodes for the project in the given date range. Also add
    # a computed field which is just the day of the last edited date/time.
    tree_nodes = Treenode.objects \
        .filter(
            project=project_id,
            creation_time__range=(start_date, end_date)) \
        .extra(select={
            'date': 'to_char("treenode"."creation_time", \'YYYYMMDD\')'}) \
        .order_by('user', 'date')
    # Get the count of tree nodes for each user/day combination.
    treenode_stats = tree_nodes.values('user__username', 'date', 'user__id') \
        .annotate(count=Count('id'))
    # Change the 'user__username' field name to just 'name'. (If
    # <https://code.djangoproject.com/ticket/12222> ever gets implemented then
    # this wouldn't be necessary.)
    treenode_stats = [{
        'username': stat['user__username'],
        'userid': stat['user__id'],
        'date':stat['date'],
        'count':stat['count']} for stat in treenode_stats]

    connector_nodes = Connector.objects \
        .filter(
            project=project_id,
            creation_time__range=(start_date, end_date)) \
        .extra(select={
            'date': 'to_char("connector"."creation_time", \'YYYYMMDD\')'}) \
        .order_by('user', 'date')
    connector_stats = connector_nodes.values('user__username', 'date', 'user__id') \
        .annotate(count=Count('id'))
    connector_stats = [{
        'username': stat['user__username'],
        'userid': stat['user__id'],
        'date': stat['date'],
        'count': stat['count']} for stat in connector_stats]

    tree_reviewed_nodes = Review.objects \
        .filter(
            project_id=project_id,
            review_time__range=(start_date, end_date)) \
        .extra(select={
            'date': 'to_char("review"."review_time", \'YYYYMMDD\')'}) \
        .order_by('date') \
        .values('reviewer_id', 'date') \
        .annotate(count = Count('treenode'))

    for di in treenode_stats:
        stats_table[di['username']][di['date']]['new_treenodes'] = di['count']

    for di in connector_stats:
        stats_table[di['username']][di['date']]['new_connectors'] = di['count']

    for di in tree_reviewed_nodes:
        name = map_userid_to_name[di['reviewer_id']]
        stats_table[name][di['date']]['new_reviewed_nodes'] = di['count']

    return HttpResponse(json.dumps({
        'stats_table': stats_table,
        'days': days,
        'daysformatted': daysformatted}), mimetype='text/json')

